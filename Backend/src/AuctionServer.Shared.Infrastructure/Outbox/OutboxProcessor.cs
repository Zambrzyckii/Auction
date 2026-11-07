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
    private const int BatchSize = 20;
    private static readonly TimeSpan Retention = TimeSpan.FromDays(7);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(1);

    private DateTime _nextCleanupOn;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunPassAsync(stoppingToken);
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

    public async Task RunPassAsync(CancellationToken stoppingToken)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TContext>();

        if (DateTime.UtcNow >= _nextCleanupOn)
        {
            var removed = await OutboxCourier.CleanupAsync(context, Retention, stoppingToken);
            if (removed > 0)
                logger.LogInformation("Outbox cleanup removed {Count} processed messages", removed);
            _nextCleanupOn = DateTime.UtcNow + CleanupInterval;
        }

        var messages = await OutboxCourier.ClaimAsync(context, BatchSize, stoppingToken);

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
            catch (TransportUnavailableException e)
            {
                var index = messages.IndexOf(message);
                foreach (var claimed in messages.Skip(index)) claimed.ReleaseLease();
                await context.SaveChangesAsync(stoppingToken);
                logger.LogWarning(e,
                    "Transport unavailable; released {Count} leases and aborted the outbox pass", messages.Count - index);
                return;
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
