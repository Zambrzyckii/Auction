using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.CraftItem;

public record CraftItemCommand(Guid OwnerId, IReadOnlyList<Guid> IngredientsIds) : IRequest<Guid>; 