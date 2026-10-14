using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Modules.Warehouses.Infrastructure.Inbox;
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
