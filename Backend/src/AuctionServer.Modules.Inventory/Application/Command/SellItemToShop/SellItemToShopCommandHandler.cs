using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;

public sealed class SellItemToShopCommandHandler(IItemRepository repository) : IRequestHandler<SellItemToShopCommand>
{
    public async Task Handle(SellItemToShopCommand request, CancellationToken cancellationToken)
    {
        var itemToSell = await repository.GetUserItemAsync(request.OwnerId, request.ItemId, cancellationToken);
        
        itemToSell.SellToOfficialShop();
        
        var outboxMessage = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = nameof(ItemSoldToShopEvent),
            Content = JsonSerializer.Serialize(new ItemSoldToShopEvent(
                Guid.NewGuid(), itemToSell.PublicItemId, itemToSell.OwnerUserId, itemToSell.OfficialPrice))
        };
        await repository.SaveChangesWithOutboxAsync(outboxMessage, CancellationToken.None);
    }
}