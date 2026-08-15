using System.Text.Json;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Auctions.Infrastructure.Background;

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
        var context = scope.ServiceProvider.GetRequiredService<AuctionDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();

        var messages = await context.OutboxMessages
            .Where(m => m.ProcessedOn == null)
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
                logger.LogError(e, "Failed to process outbox message {MessageId}", message.Id);
            }

            await context.SaveChangesAsync(stoppingToken);
        }
    }

    private static INotification DeserializeEvent(OutboxMessage message) => message.Type switch
    {
        nameof(BidPlacedEvent) => JsonSerializer.Deserialize<BidPlacedEvent>(message.Content)
                                  ?? throw new JsonException($"Empty payload in outbox message {message.Id}"),
        nameof(AuctionFinishedEvent) => JsonSerializer.Deserialize<AuctionFinishedEvent>(message.Content) 
                                        ?? throw new JsonException($"Empty payload in outbox message {message.Id}"),
        _ => throw new NotSupportedException($"Unknown outbox message type: {message.Type}")
    };
}
