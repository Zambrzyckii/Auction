using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public sealed class PlaceBidCommandHandler(IAuctionRepository repository) : IRequestHandler<PlaceBidCommand>
{
    public async Task Handle(PlaceBidCommand command, CancellationToken token)
    {
        var currentAuction = await repository.GetAuctionByIdAsync(command.PublicAuctionId, token);
        currentAuction.RequestBid(command.BidderId, command.NewPrice);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(FundsLockRequestedEvent),
            Content = JsonSerializer.Serialize(new FundsLockRequestedEvent(eventId, currentAuction.PublicAuctionId,
                command.BidderId, command.NewPrice))
        };

        await repository.SaveChangesWithOutboxAsync(outboxMessage, token);
    }
}