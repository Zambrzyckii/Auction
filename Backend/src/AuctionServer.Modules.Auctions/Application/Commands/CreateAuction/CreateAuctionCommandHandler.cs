using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.CreateAuction;

public sealed class CreateAuctionCommandHandler(IAuctionRepository repository) : IRequestHandler<CreateAuctionCommand, Guid>
{
    public async Task<Guid> Handle(CreateAuctionCommand request, CancellationToken cancellationToken)
    {
        var auction = Auction.Create(request.SellerId, request.ItemId, request.StartingPrice, request.EndsOn.UtcDateTime);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(ItemLockRequestedEvent),
            Content = JsonSerializer.Serialize(new ItemLockRequestedEvent(eventId, auction.PublicAuctionId, auction.ItemId, auction.SellerUserId))
        };

        await repository.CreateAuctionAsync(auction, outboxMessage, cancellationToken);

        return auction.PublicAuctionId;
    }
}
