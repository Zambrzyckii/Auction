using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Inbox;
using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Warehouses.Infrastructure.Persistence;

public sealed class WarehouseRepository(WarehouseDbContext context) : IWarehouseRepository
{
    public async Task<WarehouseWar> GetWarByPublicIdAsync(Guid publicWarehouseId, CancellationToken token)
    {
        var war = await context.Wars.SingleOrDefaultAsync(w => w.PublicWarehouseId == publicWarehouseId, token);
        if (war is null) throw new WarehouseExceptions.WarehouseNotFoundException(publicWarehouseId);
        return war;
    }

    public void AddStock(List<StockItem> stockItems) => context.StockItems.AddRange(stockItems);

    public Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token) =>
        context.ApplyOnceAsync(eventId, change, token);

    public Task ApplyOnceAsync(Guid eventId, Func<Task<OutboxMessage?>> change, CancellationToken token) =>
        context.ApplyOnceAsync(eventId, change, token);

    public async Task SaveWarWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
        await context.SaveChangesAsync(token);
    }

    public async Task SaveWarAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }

    public async Task<List<WarehouseWar>> GetActiveWarsReadOnlyAsync(int limit, CancellationToken token)
    {
        return await context.Wars.AsNoTracking()
            .Where(w => w.Status == WarehouseWarStatus.Open || w.Status == WarehouseWarStatus.Bidding)
            .OrderBy(w => w.CreatedOn)
            .Take(limit)
            .ToListAsync(token);
    }

    public async Task<WarehouseWar> GetWarByPublicIdReadOnlyAsync(Guid publicWarehouseId, CancellationToken token)
    {
        var war = await context.Wars.AsNoTracking()
            .SingleOrDefaultAsync(w => w.PublicWarehouseId == publicWarehouseId, token);
        if (war is null) throw new WarehouseExceptions.WarehouseNotFoundException(publicWarehouseId);
        return war;
    }

    public async Task<Dictionary<Guid, int>> GetStockCountsReadOnlyAsync(List<Guid> publicWarehouseIds, CancellationToken token)
    {
        return await context.StockItems.AsNoTracking()
            .Where(s => publicWarehouseIds.Contains(s.PublicWarehouseId))
            .GroupBy(s => s.PublicWarehouseId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, token);
    }

    public async Task<List<StockItem>> GetStockReadOnlyAsync(Guid publicWarehouseId, CancellationToken token)
    {
        return await context.StockItems.AsNoTracking()
            .Where(s => s.PublicWarehouseId == publicWarehouseId)
            .ToListAsync(token);
    }
}
