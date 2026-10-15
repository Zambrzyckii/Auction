using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Command.BuyBot;

public class BuyBotCommandHandler(IPawnshopRepository repository, PawnshopOptions options) : IRequestHandler<BuyBotCommand>
{
    public async Task Handle(BuyBotCommand request, CancellationToken token)
    {
        var tier = options.BotTiers.SingleOrDefault(t => t.Name == request.TierName)
                   ?? throw new PawnshopExceptions.BotTierNotFoundException(request.TierName);

        var shop = await repository.GetLiveShopByUserIdAsync(request.UserId, token);
        var paymentId = shop.BeginBotPurchase(tier.Name, tier.Rarity, tier.SpawnInterval, tier.PayoutRate,
            DateTime.UtcNow);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(PawnshopPaymentRequestedEvent),
            Content = JsonSerializer.Serialize(new PawnshopPaymentRequestedEvent(
                eventId, shop.PublicPawnshopId, paymentId, request.UserId, tier.Price, 0m))
        };
        await repository.SaveChangesWithOutboxAsync(outboxMessage, token);
    }
}
