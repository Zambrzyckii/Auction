using System.Text.Json;
using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.PurchaseChips;

public class PurchaseChipsCommandHandler(ICasinoRepository repository) : IRequestHandler<PurchaseChipsCommand, Guid>
{
    public async Task<Guid> Handle(PurchaseChipsCommand request, CancellationToken token)
    {
        var now = DateTime.UtcNow;
        var account = await repository.FindAccountByUserIdAsync(request.UserId, token);
        if (account is null) repository.AddAccount(ChipAccount.Open(request.UserId, now));

        var purchase = ChipPurchase.Request(request.UserId, request.Amount, now);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(CasinoChipPurchaseRequestedEvent),
            Content = JsonSerializer.Serialize(new CasinoChipPurchaseRequestedEvent(
                eventId, purchase.PublicPurchaseId, request.UserId, request.Amount))
        };
        await repository.SaveNewPurchaseWithOutboxAsync(purchase, outboxMessage, token);
        return purchase.PublicPurchaseId;
    }
}
