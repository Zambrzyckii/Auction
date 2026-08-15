using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;

public interface IAuctionRepository
{
    public Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    public Task<Auction> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token);
    public Task CreateAuctionAsync(Auction auction, CancellationToken token);
}