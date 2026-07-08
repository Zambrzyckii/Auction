using System.Text.Json;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AuctionServer.Modules.Auctions.Infrastructure.Background;

public class OutboxProcessor(IServiceProvider serviceProvider) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var publisher = scope.ServiceProvider.GetRequiredService<IPublisher>();

            var messages = context.OutboxMessages.Where(m => m.ProcessedOn == null).ToList();

            foreach (var message in messages)
            {
                var domainEvent = JsonSerializer.Deserialize<BidPlacedEvent>(message.Content);

                if (domainEvent is not null) await publisher.Publish(domainEvent, stoppingToken);
                
                message.MarkAsProcessed();
            }

            if (messages.Any()) await context.SaveChangesAsync(stoppingToken);

            await Task.Delay(3000, stoppingToken);
        }
    }
}