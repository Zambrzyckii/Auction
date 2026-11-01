using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Inbox;
using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;

public sealed class PawnshopRepository(PawnshopDbContext context) : IPawnshopRepository
{
    public async Task<Shop> GetShopByPublicIdAsync(Guid publicPawnshopId, CancellationToken token)
    {
        var shop = await context.Shops.SingleOrDefaultAsync(s => s.PublicPawnshopId == publicPawnshopId, token);
        
        if (shop is null) throw new PawnshopExceptions.PawnshopNotFoundException();
        
        return shop;
    }

    public async Task<Shop> GetLiveShopByUserIdAsync(Guid userId, CancellationToken token)
    {
        var shop = await context.Shops
            .SingleOrDefaultAsync(s => s.UserId == userId && s.Status != ShopStatus.Rejected, token);
        
        if (shop is null) throw new PawnshopExceptions.PawnshopNotFoundException();
        return shop;
    }

    public async Task<Shop?> GetLatestShopByUserIdReadOnlyAsync(Guid userId, CancellationToken token)
    {
        return await context.Shops.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.RequestedOn)
            .FirstOrDefaultAsync(token);
    }

    public async Task SaveNewShopWithOutboxAsync(Shop shop, OutboxMessage outboxMessage, CancellationToken token)
    {
        context.Shops.Add(shop);
        context.OutboxMessages.Add(outboxMessage);
        
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new PawnshopExceptions.PawnshopAlreadyOwnedException();
        }
    }

    public async Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
        await context.SaveChangesAsync(token);
    }

    public void AddStock(IReadOnlyList<StockItem> items) => context.StockItems.AddRange(items);

    public Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token) =>
        context.ApplyOnceAsync(eventId, change, token);

    public async Task<List<StockItem>> GetStockReadOnlyAsync(Guid publicPawnshopId, CancellationToken token)
    {
        var inStock = await context.StockItems.AsNoTracking()
            .Where(i => i.PublicPawnshopId == publicPawnshopId && i.Status == StockItemStatus.InStock)
            .OrderBy(i => i.SellAfter)
            .ToListAsync(token);
        
        var resolved = await context.StockItems.AsNoTracking()
            .Where(i => i.PublicPawnshopId == publicPawnshopId && i.Status != StockItemStatus.InStock)
            .OrderByDescending(i => i.ResolvedOn)
            .Take(20)
            .ToListAsync(token);
        
        return inStock.Concat(resolved).ToList();
    }

    public async Task<StockItem> GetStockItemByPublicIdAsync(Guid publicStockItemId, CancellationToken token)
    {
        var item = await context.StockItems.SingleOrDefaultAsync(i => i.PublicStockItemId == publicStockItemId, token);
        
        if (item is null) throw new PawnshopExceptions.StockItemNotFoundException();
        
        return item;
    }
}
