using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.CraftItem;

public sealed class CraftItemCommandHandler(IItemRepository repository) : IRequestHandler<CraftItemCommand, Guid>
{

    public async Task<Guid> Handle(CraftItemCommand request, CancellationToken cancellationToken)
    {
        var ingredients = await repository.GetUserSelectedItemsAsync(request.OwnerId, request.IngredientsIds, cancellationToken);

        var craftedItem = Item.Craft(ingredients);
        await repository.AddItemAsync(craftedItem, CancellationToken.None);

        return craftedItem.PublicItemId;
    }
}