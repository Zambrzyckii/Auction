using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;

public interface IAuctionRepository
{
    public Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    public Task<Auction> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token);
    public Task CreateAuctionAsync(Auction auction, OutboxMessage outboxMessage, CancellationToken token);
    public void AddBid(Bid bid);
    public Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    public Task ApplyOnceAsync(Guid eventId, Func<Task<OutboxMessage?>> change, CancellationToken token);
}
