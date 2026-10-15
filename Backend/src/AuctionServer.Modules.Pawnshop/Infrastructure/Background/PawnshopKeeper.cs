using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
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
        await ExpireStaleStockRequestsAsync(context, token);
        await RequestDueSpawnsAsync(context, token);
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

    private async Task ExpireStaleStockRequestsAsync(PawnshopDbContext context, CancellationToken token)
    {
        var cutoff = DateTime.UtcNow - options.StockRequestTimeout;
        var staleShops = await context.Shops
            .Where(s => s.PendingStockRequestId != null && s.PendingStockRequestedOn <= cutoff)
            .Take(50)
            .ToListAsync(token);
        if (staleShops.Count == 0) return;

        foreach (var shop in staleShops)
        {
            logger.LogWarning("Expiring stale stock request for pawnshop {PublicPawnshopId}", shop.PublicPawnshopId);
            shop.ExpireStockRequest();
        }

        await context.SaveChangesAsync(token);
    }

    private async Task RequestDueSpawnsAsync(PawnshopDbContext context, CancellationToken token)
    {
        var now = DateTime.UtcNow;
        var dueShops = await context.Shops
            .Where(s => s.Status == ShopStatus.Active && s.BotRarity != null
                        && s.PendingStockRequestId == null && s.NextSpawnOn <= now)
            .Take(50)
            .ToListAsync(token);
        if (dueShops.Count == 0) return;

        foreach (var shop in dueShops)
        {
            var (requestId, rarity) = shop.RequestSpawn(now);
            context.OutboxMessages.Add(new OutboxMessage
            {
                Id = requestId,
                Type = nameof(PawnshopStockRequestedEvent),
                Content = JsonSerializer.Serialize(new PawnshopStockRequestedEvent(
                    requestId, shop.PublicPawnshopId, [rarity.ToString()]))
            });
        }

        await context.SaveChangesAsync(token);
    }
}
