using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;

public interface IAuctionRepository
{
    public Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    public Task<Auction> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token);
    public Task CreateAuctionAsync(Auction auction, OutboxMessage outboxMessage, CancellationToken token);
    public Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    public Task SaveChangesWithInboxAsync(ProcessedMessage message, CancellationToken token);
    public Task SaveChangesWithInboxAndOutboxAsync(ProcessedMessage message, OutboxMessage outboxMessage, CancellationToken token);
}