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
        var previousPrice = currentAuction.CurrentPrice;
        var previousWinnerId = currentAuction.CurrentWinningUserId;
        currentAuction.ApplyNewBid(command.BidderId, command.NewPrice);

        var outboxMessage = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = nameof(BidPlacedEvent),
            Content = JsonSerializer.Serialize(new BidPlacedEvent(currentAuction.PublicAuctionId, command.BidderId,
                previousWinnerId, command.NewPrice, previousPrice))
        };

        await repository.SaveChangesWithOutboxAsync(outboxMessage, token);
    }

}