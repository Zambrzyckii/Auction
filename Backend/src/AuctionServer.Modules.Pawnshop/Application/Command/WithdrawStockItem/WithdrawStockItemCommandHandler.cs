using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Command.WithdrawStockItem;

public class WithdrawStockItemCommandHandler(IPawnshopRepository repository) : IRequestHandler<WithdrawStockItemCommand>
{
    public async Task Handle(WithdrawStockItemCommand request, CancellationToken token)
    {
        var item = await repository.GetStockItemByPublicIdAsync(request.PublicStockItemId, token);

        if (request.UserId != item.UserId) throw new PawnshopExceptions.StockItemNotFoundException();

        item.Withdraw(DateTime.UtcNow);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(PawnshopItemWithdrawnEvent),
            Content = JsonSerializer.Serialize(new PawnshopItemWithdrawnEvent(
                eventId, item.PublicPawnshopId, item.PublicStockItemId, item.UserId, item.Name,
                item.Rarity.ToString(), item.Price))
        };
        await repository.SaveChangesWithOutboxAsync(outboxMessage, CancellationToken.None);
    }
}
