using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Background;

public sealed class PawnshopKeeper(IServiceProvider serviceProvider, ILogger<PawnshopKeeper> logger, PawnshopOptions options)
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
                logger.LogError(e, "Pawnshop keeper cycle failed");
            }

            await Task.Delay(5000, stoppingToken);
        }
    }

    private async Task RunCycleAsync(CancellationToken token)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<PawnshopDbContext>();
        await ExpireStalePaymentsAsync(context, token);
    }

    private async Task ExpireStalePaymentsAsync(PawnshopDbContext context, CancellationToken token)
    {
        var cutoff = DateTime.UtcNow - options.PaymentTimeout;
        var staleShops = await context.Shops
            .Where(s => s.PendingPaymentId != null && s.PendingPaymentRequestedOn <= cutoff)
            .Take(50)
            .ToListAsync(token);
        if (staleShops.Count == 0) return;

        foreach (var shop in staleShops)
        {
            logger.LogWarning("Expiring stale payment for pawnshop {PublicPawnshopId}", shop.PublicPawnshopId);
            shop.ExpirePayment();
        }

        await context.SaveChangesAsync(token);
    }
}
