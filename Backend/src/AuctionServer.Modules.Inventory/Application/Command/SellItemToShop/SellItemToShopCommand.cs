using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;

public record SellItemToShopCommand(Guid OwnerId, Guid ItemId) : IRequest;