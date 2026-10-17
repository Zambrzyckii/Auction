using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Casino.Infrastructure.Background;

public sealed class CasinoKeeper(IServiceProvider serviceProvider, ILogger<CasinoKeeper> logger, CasinoOptions options)
    : BackgroundService
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
}
