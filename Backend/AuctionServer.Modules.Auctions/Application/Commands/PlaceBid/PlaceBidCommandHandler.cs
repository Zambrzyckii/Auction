using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public class PlaceBidCommandHandler(IAuctionRepository repository) : IRequestHandler<PlaceBidCommand>
{
    public async Task Handle(PlaceBidCommand command, CancellationToken token)
    {
        var currentAuction = await repository.GetAuctionByIdAsync(command.PublicAuctionId, token);

        var previousWinnerId = currentAuction!.CurrentWinningUserId;
        currentAuction!.ApplyNewBid(command.BidderId,command.NewPrice);

        var outboxMessage = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = "BidPlacedEvent",
            Content = JsonSerializer.Serialize(new BidPlacedEvent(currentAuction.PublicAuctionId, currentAuction.CurrentWinningUserId.Value,
                previousWinnerId, currentAuction.CurrentPrice))
        };

        await repository.SaveAuctionAndOutboxAsync(currentAuction, outboxMessage, token);
    }

}