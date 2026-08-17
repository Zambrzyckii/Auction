using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.CraftItem;

public sealed class CraftItemCommandHandler(IItemRepository repository) : IRequestHandler<CraftItemCommand, Item>
{

    public async Task<Item> Handle(CraftItemCommand request, CancellationToken cancellationToken)
    {
        throw new NotImplementedException();
    }
}