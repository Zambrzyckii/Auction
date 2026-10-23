using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Messaging;
using AuctionServer.Shared.Integration.Observability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Casino.Infrastructure.Background;

public sealed class OutboxProcessor(IServiceProvider serviceProvider, ILogger<OutboxProcessor> logger) : BackgroundService
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
        var context = scope.ServiceProvider.GetRequiredService<CasinoDbContext>();

        var messages = await context.OutboxMessages
            .Where(m => m.ProcessedOn == null && !m.IsDead && (m.NextAttemptOn == null || m.NextAttemptOn <= DateTime.UtcNow))
            .OrderBy(m => m.CreatedOn)
            .Take(20)
            .ToListAsync(stoppingToken);

        foreach (var message in messages)
        {
            try
            {
                using var publishScope = serviceProvider.CreateScope();
                var eventPublisher = publishScope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();
                await eventPublisher.PublishAsync(message.Id, message.Type, message.Content, stoppingToken);
                message.MarkAsProcessed();
                OutboxMetrics.RecordProcessed("Casino", DateTime.UtcNow - message.CreatedOn);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception e)
            {
                message.FailedAttempt(e.Message);
                OutboxMetrics.RecordFailed("Casino");
                if(message.AttemptCount > 5)
                {
                    message.MarkMessageAsDead();
                    OutboxMetrics.RecordDead("Casino");
                }
                logger.LogError(e, "Failed to process outbox message {MessageId}", message.Id);
            }

            await context.SaveChangesAsync(stoppingToken);
        }
    }
}
