using System.Text.Json;
using AuctionServer.Modules.Identity.Infrastructure.Outbox;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Identity.Infrastructure.Background;

public class OutboxProcessor(IServiceProvider serviceProvider, ILogger<OutboxProcessor> logger) : BackgroundService
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
        var context = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();

        var messages = await context.OutboxMessages
            .Where(m => m.ProcessedOn == null && !m.IsDead && (m.NextAttemptOn == null || m.NextAttemptOn <= DateTime.UtcNow))
            .OrderBy(m => m.CreatedOn)
            .Take(20)
            .ToListAsync(stoppingToken);

        foreach (var message in messages)
        {
            try
            {
                var domainEvent = DeserializeEvent(message);
                await publisher.Publish(domainEvent, stoppingToken);
                message.MarkAsProcessed();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception e)
            {
                message.FailedAttempt(e.Message);
                if (message.AttemptCount > 5) message.MarkMessageAsDead();
                logger.LogError(e, "Failed to process outbox message {MessageId}", message.Id);
            }

            await context.SaveChangesAsync(stoppingToken);
        }
    }

    private static INotification DeserializeEvent(OutboxMessage message) => message.Type switch
    {
        nameof(UserRegisteredEvent) => JsonSerializer.Deserialize<UserRegisteredEvent>(message.Content)
                                  ?? throw new JsonException($"Empty payload in outbox message {message.Id}"),
        _ => throw new NotSupportedException($"Unknown outbox message type: {message.Type}")
    };
}
