using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Cards;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Casino.Infrastructure.Background;

public sealed class CasinoKeeper(IServiceProvider serviceProvider, ILogger<CasinoKeeper> logger,
    CasinoOptions options, ICardSource cardSource) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCycleAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Casino keeper cycle failed");
            }

            await Task.Delay(5000, stoppingToken);
        }
    }

    private async Task RunCycleAsync(CancellationToken token)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<CasinoDbContext>();
        await ExpireStalePurchasesAsync(context, token);
        await AutoStandAbandonedHandsAsync(context, token);
    }

    private async Task ExpireStalePurchasesAsync(CasinoDbContext context, CancellationToken token)
    {
        var cutoff = DateTime.UtcNow - options.PurchaseTimeout;
        var stalePurchases = await context.ChipPurchases
            .Where(p => p.Status == ChipPurchaseStatus.Pending && p.RequestedOn <= cutoff)
            .Take(50)
            .ToListAsync(token);
        if (stalePurchases.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var purchase in stalePurchases)
        {
            logger.LogWarning("Expiring stale chip purchase {PublicPurchaseId}", purchase.PublicPurchaseId);
            purchase.Expire(now);
        }

        await context.SaveChangesAsync(token);
    }

    private async Task AutoStandAbandonedHandsAsync(CasinoDbContext context, CancellationToken token)
    {
        var cutoff = DateTime.UtcNow - options.Blackjack.HandTimeout;
        var abandonedHands = await context.BlackjackHands
            .Where(h => h.Status == BlackjackHandStatus.InProgress && h.LastActionOn <= cutoff)
            .Take(50)
            .ToListAsync(token);
        if (abandonedHands.Count == 0) return;

        var userIds = abandonedHands.Select(h => h.UserId).Distinct().ToList();
        var accounts = await context.ChipAccounts
            .Where(a => userIds.Contains(a.UserId))
            .ToDictionaryAsync(a => a.UserId, token);

        var now = DateTime.UtcNow;
        foreach (var hand in abandonedHands)
        {
            logger.LogWarning("Auto-standing abandoned blackjack hand {PublicHandId}", hand.PublicHandId);
            hand.AutoStand(cardSource, now);
            if (hand.Payout > 0) accounts[hand.UserId].Credit(hand.Payout.Value);
        }

        await context.SaveChangesAsync(token);
    }
}
