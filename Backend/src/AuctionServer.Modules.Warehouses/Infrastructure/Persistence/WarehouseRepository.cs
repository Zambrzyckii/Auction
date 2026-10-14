using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Modules.Warehouses.Infrastructure.Inbox;
using AuctionServer.Modules.Warehouses.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Warehouses.Infrastructure.Persistence;

public sealed class WarehouseRepository(WarehouseDbContext context) : IWarehouseRepository
{
    public async Task<WarehouseWar> GetWarByPublicIdAsync(Guid publicWarehouseId, CancellationToken token)
    {
        var war = await context.Wars.SingleOrDefaultAsync(w => w.PublicWarehouseId == publicWarehouseId, token);
        if (war is null) throw new WarehouseExceptions.WarehouseNotFoundException(publicWarehouseId);
        return war;
    }

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token)
    {
        return await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);
    }

    public async Task SaveStockWithInboxAsync(List<StockItem> stockItems, ProcessedMessage inboxMessage, CancellationToken token)
    {
        await context.StockItems.AddRangeAsync(stockItems, token);
        context.ProcessedMessages.Add(inboxMessage);
        await SaveTranslatingUniqueViolationAsync(token);
    }

    public async Task SaveWarWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token)
    {
        context.ProcessedMessages.Add(inboxMessage);
        await SaveTranslatingUniqueViolationAsync(token);
    }

    public async Task SaveWarWithInboxAndOutboxAsync(ProcessedMessage inboxMessage, OutboxMessage outboxMessage, CancellationToken token)
    {
        context.ProcessedMessages.Add(inboxMessage);
        context.OutboxMessages.Add(outboxMessage);
        await SaveTranslatingUniqueViolationAsync(token);
    }

    public async Task SaveWarWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
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

    private async Task SaveTranslatingUniqueViolationAsync(CancellationToken token)
    {
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new WarehouseExceptions.EventAlreadyProcessedException();
        }
    }
}
