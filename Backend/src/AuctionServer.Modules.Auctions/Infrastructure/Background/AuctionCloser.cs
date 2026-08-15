using System.Text.Json;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Auctions.Infrastructure.Background;

public sealed class AuctionCloser(IServiceProvider serviceProvider, ILogger<AuctionCloser> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CLoseExpiredAuctionAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Auction closing cycle failed");
            }

            await Task.Delay(3000, stoppingToken);
        }
    }

    private async Task CLoseExpiredAuctionAsync(CancellationToken stoppingToken)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AuctionDbContext>();

        var expiredAuctions = await context.Auctions
            .Where(a => !a.IsClosed && a.EndsOn <= DateTime.UtcNow)
            .Take(20)
            .ToListAsync(stoppingToken);

        foreach (var auction in expiredAuctions)
        {
            auction.CloseAuction();

            var eventId = Guid.NewGuid();

            context.OutboxMessages.Add(new OutboxMessage
            {
                Id = eventId,
                Type = nameof(AuctionFinishedEvent),
                Content = JsonSerializer.Serialize(new AuctionFinishedEvent(eventId, auction.PublicAuctionId, auction.SellerUserId
                    , auction.CurrentWinningUserId, auction.CurrentWinningUserId is null ? null : auction.CurrentPrice))
            });
        }

        if (expiredAuctions.Count > 0) await context.SaveChangesAsync(stoppingToken);
    }
}