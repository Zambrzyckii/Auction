using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Command.OpenPawnshop;

public class OpenPawnshopCommandHandler(IPawnshopRepository repository, PawnshopOptions options)
    : IRequestHandler<OpenPawnshopCommand, Guid>
{
    public async Task<Guid> Handle(OpenPawnshopCommand request, CancellationToken token)
    {
        var shop = Shop.Open(request.UserId, DateTime.UtcNow);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(PawnshopPaymentRequestedEvent),
            Content = JsonSerializer.Serialize(new PawnshopPaymentRequestedEvent(
                eventId, shop.PublicPawnshopId, shop.PendingPaymentId!.Value, request.UserId,
                options.PremisesPrice, options.PremisesRequiredTurnover))
        };
        await repository.SaveNewShopWithOutboxAsync(shop, outboxMessage, token);
        return shop.PublicPawnshopId;
    }
}
