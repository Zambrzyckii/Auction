using AuctionServer.Modules.Inventory.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;

public sealed class SellItemToShopCommandHandler(IItemRepository repository) : IRequestHandler<SellItemToShopCommand>
{
    public async Task Handle(SellItemToShopCommand request, CancellationToken cancellationToken)
    {
        var itemToSell = await repository.GetUserItemAsync(request.OwnerId, request.ItemId, cancellationToken);
        
        
        itemToSell.SellToOfficialShop();
    }
}