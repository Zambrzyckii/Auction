using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public class PlaceBidCommandHandler(IAuctionRepository repository) : IRequestHandler<PlaceBidCommand>
{
    public async Task Handle(PlaceBidCommand command, CancellationToken token)
    {
        var currentAuction = await repository.GetAuctionByIdAsync(command.PublicAuctionId, token);
        currentAuction!.ApplyNewBid(command.NewPrice);
        await repository.SaveAuctionAsync(currentAuction, token);
    }

}