using System.Text.Json;
using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.CashOutChips;

public class CashOutChipsCommandHandler(ICasinoRepository repository) : IRequestHandler<CashOutChipsCommand>
{
    public async Task Handle(CashOutChipsCommand request, CancellationToken token)
    {
        var account = await repository.GetAccountByUserIdAsync(request.UserId, token);
        account.CashOut(request.Amount);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(CasinoCashOutEvent),
            Content = JsonSerializer.Serialize(new CasinoCashOutEvent(eventId, request.UserId, request.Amount))
        };
        await repository.SaveChangesWithOutboxAsync(outboxMessage, token);
    }
}
