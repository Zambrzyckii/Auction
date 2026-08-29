using AuctionServer.Modules.Inventory.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Command.GrantItem;

public record GrantItemCommand(Guid OwnerId, string Name, ItemRarity Rarity) : IRequest<Guid>;