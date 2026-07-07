using AuctionServer.Modules.Auctions.Domain.Entities;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Repository;

public interface IAuctionRepository
{
    public Task SaveAuctionAsync(Auction auction,  CancellationToken token);
    public Task<Auction?> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token);
}