using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public class PlaceBidCommandHandler(IAuctionRepository repository)
{
    public async Task Handle(PlaceBidCommand command)
    {
        var currentAuction = await repository.GetAuctionByIdAsync(command.PublicAuctionId);
        currentAuction.ApplyNewBid(command.NewPrice);
        await repository.SaveAuctionAsync(currentAuction);
    }
}