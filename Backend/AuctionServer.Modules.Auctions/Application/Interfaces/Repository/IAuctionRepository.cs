using AuctionServer.Modules.Auctions.Domain.Entities;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Repository;

public interface IAuctionRepository
{
    public Task SaveAuctionAsync(Auction auction);
    public Task<Auction> GetAuctionByIdAsync(Guid publicAuctionId);
}