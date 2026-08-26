using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Inventory.Infrastructure.Persistence;

public sealed class ItemRepository(InventoryDbContext context) : IItemRepository
{
    public async Task<Item> GetUserItemAsync(Guid ownerUserId, Guid publicItemId, CancellationToken token)
    {
        var userItem = await context.Items
            .SingleOrDefaultAsync(inventory => inventory.OwnerUserId == ownerUserId && inventory.PublicItemId == publicItemId, token);
        if (userItem is null) throw new InventoryException.UserOrItemDoesntExistException();
        return userItem;
    }

    public async Task<List<Item>> GetUserSelectedItemsAsync(Guid ownerUserId, IReadOnlyList<Guid> publicItemIds, CancellationToken token)
    {
        var userItems = await context.Items.Where(inventory => inventory.OwnerUserId == ownerUserId && publicItemIds.Contains(inventory.PublicItemId)).ToListAsync(token);
        if (userItems.Count != publicItemIds.Count) throw new InventoryException.UserOrItemDoesntExistException();
        return userItems;
    }

    public async Task<List<Item>> GetUserItemsReadOnlyAsync(Guid ownerUserId, CancellationToken token)
    {
        var userItems = await context.Items.Where(inventory => inventory.OwnerUserId == ownerUserId 
                                                               && inventory.Status != ItemStatus.Consumed 
                                                               && inventory.Status != ItemStatus.SoldToShop).AsNoTracking().ToListAsync(token);
        return userItems;
    }
    
    public async Task AddItemAsync(Item item, CancellationToken token)
    {
        await context.Items.AddAsync(item, token);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                                     {
                                                         SqlState: PostgresErrorCodes.UniqueViolation
                                                     })
        {
            throw new InventoryException.ItemAlreadyExistInInventoryException();
        } 
    }

    public async Task AddItemsAsync(List<Item> items, CancellationToken token)
    {
        await context.Items.AddRangeAsync(items, token);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                                     {
                                                         SqlState: PostgresErrorCodes.UniqueViolation
                                                     })
        {
            throw new InventoryException.ItemAlreadyExistInInventoryException();
        } 
    }

    public async Task SaveAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }
}