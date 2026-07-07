using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Events;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public class PlaceBidCommandHandler(IAuctionRepository repository) : IRequestHandler<PlaceBidCommand>
{
    public async Task Handle(PlaceBidCommand command, CancellationToken token)
    {
        var currentAuction = await repository.GetAuctionByIdAsync(command.PublicAuctionId, token);
        currentAuction!.ApplyNewBid(command.NewPrice);

        var outboxMessage = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = "BidPlacedEvent",
            Content = JsonSerializer.Serialize(new BidPlacedEvent(currentAuction.PublicAuctionId,
                currentAuction.CurrentPrice))
        };

        await repository.SaveAuctionAndOutboxAsync(currentAuction, outboxMessage, token);
    }

}