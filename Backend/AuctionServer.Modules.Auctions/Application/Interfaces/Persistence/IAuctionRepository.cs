using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;

public interface IAuctionRepository
{
    public Task SaveAuctionAndOutboxAsync(Auction auction, OutboxMessage outboxMessage,  CancellationToken token);
    public Task<Auction?> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token);
}