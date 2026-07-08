using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Infrastructure.Persistence;

public class AuctionRepository(AuctionDbContext context) : IAuctionRepository
{
    public async Task SaveAuctionAndOutboxAsync(Auction auction,OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
        await context.SaveChangesAsync(token);
    }

    public async Task<Auction?> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token)
    {
        Auction? auction = await context.Auctions.SingleOrDefaultAsync(x => x.PublicAuctionId == publicAuctionId, token);
        if (auction is null) throw new AuctionExceptions.AuctionNotFoundException(publicAuctionId);
        return auction;
    }
}