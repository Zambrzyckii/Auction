using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;

namespace AuctionServer.Modules.Auctions.Application.Service;

public sealed class PlaceBidService(IAuctionRepository repository)
{
    public async Task PlaceBidAsync(Guid publicAuctionId , decimal newPrice)
    {
        var currentAuction = await repository.GetAuctionByIdAsync(publicAuctionId);
        currentAuction.ApplyNewBid(newPrice);
        await repository.SaveAuctionAsync(currentAuction);
    }
    
}