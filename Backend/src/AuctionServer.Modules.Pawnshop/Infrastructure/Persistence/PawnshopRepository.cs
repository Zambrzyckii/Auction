using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Inbox;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
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

    public async Task<Shop?> GetLatestShopByUserIdReadOnlyAsync(Guid userId, CancellationToken token)
    {
        return await context.Shops.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.RequestedOn)
            .FirstOrDefaultAsync(token);
    }

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token)
    {
        return await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);
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

    public async Task SaveShopWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token)
    {
        context.ProcessedMessages.Add(inboxMessage);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new PawnshopExceptions.EventAlreadyProcessedException();
        }
    }
}
