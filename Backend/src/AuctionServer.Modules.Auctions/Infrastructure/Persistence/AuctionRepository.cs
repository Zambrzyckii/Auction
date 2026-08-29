using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Auctions.Infrastructure.Persistence;

public class AuctionRepository(AuctionDbContext context) : IAuctionRepository
{
    public async Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
        await context.SaveChangesAsync(token);
    }

    public async Task<Auction> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token)
    {
        var auction = await context.Auctions.SingleOrDefaultAsync(x => x.PublicAuctionId == publicAuctionId, token);
        if (auction is null) throw new AuctionExceptions.AuctionNotFoundException(publicAuctionId);
        return auction;
    }

    public async Task CreateAuctionAsync(Auction auction, OutboxMessage outboxMessage, CancellationToken token)
    {
        context.Auctions.Add(auction);
        context.OutboxMessages.Add(outboxMessage);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                          {
                                              SqlState: PostgresErrorCodes.UniqueViolation
                                          })
        {
            throw new AuctionExceptions.AuctionAlreadyExistException();
        }
    }

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token)
    {
        return await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);
    }

    public async Task SaveChangesWithInboxAsync(ProcessedMessage message, CancellationToken token)
    {
        context.ProcessedMessages.Add(message);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new AuctionExceptions.EventAlreadyProcessedException();
        }
    }

    public async Task SaveChangesWithInboxAndOutboxAsync(ProcessedMessage message, OutboxMessage outboxMessage, CancellationToken token)
    {
        context.ProcessedMessages.Add(message);
        context.OutboxMessages.Add(outboxMessage);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new AuctionExceptions.EventAlreadyProcessedException();
        }
    }
}