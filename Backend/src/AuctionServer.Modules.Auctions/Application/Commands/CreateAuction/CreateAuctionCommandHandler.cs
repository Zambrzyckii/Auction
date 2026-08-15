using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.CreateAuction;

public sealed class CreateAuctionCommandHandler(IAuctionRepository repository) : IRequestHandler<CreateAuctionCommand, Guid>
{
    public async Task<Guid> Handle(CreateAuctionCommand request, CancellationToken cancellationToken)
    {

        var auctionToCreate = Auction.Create(request.SellerId, request.ItemId, request.StartingPrice, request.EndsOn.UtcDateTime);
        
        await repository.CreateAuctionAsync(auctionToCreate, cancellationToken);

        return auctionToCreate.PublicAuctionId;
    }
}