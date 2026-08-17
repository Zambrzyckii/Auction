using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.CraftItem;

public sealed class CraftItemCommandHandler(IItemRepository repository) : IRequestHandler<CraftItemCommand>
{

    public async Task Handle(CraftItemCommand request, CancellationToken cancellationToken)
    {
        var ingredients = await repository.GetUserSelectedItemsAsync(request.OwnerId, request.IngredientsIds, cancellationToken);
        
        if (!(ingredients.Count > 0)) throw new InventoryException.NotEnoughIngredientsToCraftException();
        
        var resultItem = Item.Craft(ingredients);

        await repository.AddItemAsync(resultItem, cancellationToken);
    }
}