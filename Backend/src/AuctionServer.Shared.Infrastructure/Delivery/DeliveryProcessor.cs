using AuctionServer.Shared.Integration.Messaging;
using AuctionServer.Shared.Integration.Observability;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public sealed class DeliveryProcessor(
    IServiceProvider serviceProvider,
    DeliveryRecipientRegistry registry,
    ILogger<DeliveryProcessor> logger) : BackgroundService
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
                await DeliverPendingMessagesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Delivery cycle failed");
            }

            await Task.Delay(3000, stoppingToken);
        }
    }

    private async Task DeliverPendingMessagesAsync(CancellationToken stoppingToken)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<DeliveryDbContext>();

        if (DateTime.UtcNow >= _nextCleanupOn)
        {
            var removed = await DeliveryCourier.CleanupAsync(context, Retention, stoppingToken);
            if (removed > 0)
                logger.LogInformation("Delivery cleanup removed {Count} processed messages", removed);
            _nextCleanupOn = DateTime.UtcNow + CleanupInterval;
        }

        var messages = await DeliveryCourier.ClaimAsync(context, BatchSize, stoppingToken);

        foreach (var message in messages)
        {
            try
            {
                var recipient = registry.For(message.Type).SingleOrDefault(r => r.Name == message.Recipient)
                    ?? throw new InvalidOperationException(
                        $"Recipient {message.Recipient} is not registered for {message.Type}");
                var notification = IntegrationEventTypes.Deserialize(message.Type, message.Content);
                using var deliveryScope = serviceProvider.CreateScope();
                await recipient.Invoke(deliveryScope.ServiceProvider, notification, stoppingToken);
                message.MarkAsProcessed();
                DeliveryMetrics.RecordProcessed(message.Recipient, DateTime.UtcNow - message.CreatedOn);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception e)
            {
                message.FailedAttempt(e.Message);
                DeliveryMetrics.RecordFailed(message.Recipient);
                if (message.AttemptCount > 5)
                {
                    message.MarkMessageAsDead();
                    DeliveryMetrics.RecordDead(message.Recipient);
                }

                logger.LogError(e, "Failed to deliver message {MessageId} to {Recipient}",
                    message.MessageId, message.Recipient);
            }

            await context.SaveChangesAsync(stoppingToken);
        }
    }
}
