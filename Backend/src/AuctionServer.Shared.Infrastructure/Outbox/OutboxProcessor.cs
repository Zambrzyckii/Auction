using AuctionServer.Shared.Integration.Messaging;
using AuctionServer.Shared.Integration.Observability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Shared.Infrastructure.Outbox;

public sealed class OutboxProcessor<TContext>(
    IServiceProvider serviceProvider,
    string moduleName,
    ILogger<OutboxProcessor<TContext>> logger) : BackgroundService where TContext : DbContext
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingMessagesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Outbox processing cycle failed");
            }

            await Task.Delay(3000, stoppingToken);
        }
    }

    private async Task ProcessPendingMessagesAsync(CancellationToken stoppingToken)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TContext>();

        var table = context.Model.FindEntityType(typeof(OutboxMessage))!.GetTableName();
        var claim = $"""
            UPDATE "{table}" SET "LeasedUntil" = now() + interval '30 seconds'
            WHERE "Id" IN (
                SELECT "Id" FROM "{table}"
                WHERE "ProcessedOn" IS NULL AND NOT "IsDead"
                  AND ("NextAttemptOn" IS NULL OR "NextAttemptOn" <= now())
                  AND ("LeasedUntil" IS NULL OR "LeasedUntil" <= now())
                ORDER BY "CreatedOn"
                LIMIT 20
                FOR UPDATE SKIP LOCKED)
            RETURNING *
            """;
        var claimed = await context.Set<OutboxMessage>().FromSqlRaw(claim).ToListAsync(stoppingToken);
        var messages = claimed.OrderBy(m => m.CreatedOn).ToList();

        foreach (var message in messages)
        {
            try
            {
                using var publishScope = serviceProvider.CreateScope();
                var eventPublisher = publishScope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();
                await eventPublisher.PublishAsync(message.Id, message.Type, message.Content, stoppingToken);
                message.MarkAsProcessed();
                OutboxMetrics.RecordProcessed(moduleName, DateTime.UtcNow - message.CreatedOn);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception e)
            {
                message.FailedAttempt(e.Message);
                OutboxMetrics.RecordFailed(moduleName);
                if (message.AttemptCount > 5)
                {
                    message.MarkMessageAsDead();
                    OutboxMetrics.RecordDead(moduleName);
                }

                logger.LogError(e, "Failed to process outbox message {MessageId}", message.Id);
            }

            await context.SaveChangesAsync(stoppingToken);
        }
    }
}
