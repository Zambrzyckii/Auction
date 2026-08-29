using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.GrantItem;

public sealed class GrantItemCommandHandler(IItemRepository repository) : IRequestHandler<GrantItemCommand, Guid>
{
    public async Task<Guid> Handle(GrantItemCommand request, CancellationToken cancellationToken)
    {
        var createdItem = Item.Create(request.OwnerId, request.Name, request.Rarity);

        await repository.AddItemAsync(createdItem, CancellationToken.None);

        return createdItem.PublicItemId;
    }
}