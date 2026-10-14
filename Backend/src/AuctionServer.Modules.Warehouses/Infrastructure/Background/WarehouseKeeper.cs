using System.Text.Json;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Infrastructure.Outbox;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Warehouses.Infrastructure.Background;

public sealed class WarehouseKeeper(IServiceProvider serviceProvider, ILogger<WarehouseKeeper> logger, WarehousesOptions options)
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
                logger.LogError(e, "Warehouse keeper cycle failed");
            }

            await Task.Delay(1000, stoppingToken);
        }
    }

    private async Task RunCycleAsync(CancellationToken token)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<WarehouseDbContext>();
        await CancelExpiredLobbiesAsync(context, token);
        await RefillPoolAsync(context, token);
    }

    private async Task CancelExpiredLobbiesAsync(WarehouseDbContext context, CancellationToken token)
    {
        var cutoff = DateTime.UtcNow - options.LobbyTimeout;
        var expired = await context.Wars
            .Where(w => w.CreatedOn < cutoff &&
                        (w.Status == WarehouseWarStatus.Stocking ||
                         (w.Status == WarehouseWarStatus.Open && w.BiddingStartsOn == null)))
            .ToListAsync(token);
        if (expired.Count == 0) return;

        foreach (var war in expired)
        {
            var reason = war.Status == WarehouseWarStatus.Stocking ? "Stock quote timed out" : "Lobby timed out";
            war.Cancel(reason);

            foreach (var participant in war.Participants.Where(p => p.State == ParticipantState.Active))
            {
                var eventId = Guid.NewGuid();
                context.OutboxMessages.Add(new OutboxMessage
                {
                    Id = eventId,
                    Type = nameof(FundsUnlockRequestedEvent),
                    Content = JsonSerializer.Serialize(
                        new FundsUnlockRequestedEvent(eventId, war.PublicWarehouseId, participant.UserId))
                });
            }
        }

        await context.SaveChangesAsync(token);
    }

    private async Task RefillPoolAsync(WarehouseDbContext context, CancellationToken token)
    {
        var openCount = await context.Wars
            .CountAsync(w => w.Status == WarehouseWarStatus.Stocking || w.Status == WarehouseWarStatus.Open, token);
        if (openCount >= options.PoolSize) return;

        for (var i = openCount; i < options.PoolSize; i++)
        {
            var tier = options.Tiers[Random.Shared.Next(options.Tiers.Count)];
            var war = WarehouseWar.Create(tier.Name, tier.EntryFee);
            var eventId = Guid.NewGuid();

            context.Wars.Add(war);
            context.OutboxMessages.Add(new OutboxMessage
            {
                Id = eventId,
                Type = nameof(WarehouseStockRequestedEvent),
                Content = JsonSerializer.Serialize(
                    new WarehouseStockRequestedEvent(eventId, war.PublicWarehouseId, RollRarities(tier)))
            });
        }

        await context.SaveChangesAsync(token);
    }

    private static List<string> RollRarities(WarehouseTierDefinition tier)
    {
        var count = Random.Shared.Next(tier.ItemCountMin, tier.ItemCountMax + 1);
        var totalWeight = tier.RarityWeights.Sum(w => w.Weight);
        var rarities = new List<string>(count);

        for (var i = 0; i < count; i++)
        {
            var roll = Random.Shared.Next(totalWeight);
            foreach (var rarityWeight in tier.RarityWeights)
            {
                roll -= rarityWeight.Weight;
                if (roll >= 0) continue;
                rarities.Add(rarityWeight.Rarity);
                break;
            }
        }

        return rarities;
    }
}
