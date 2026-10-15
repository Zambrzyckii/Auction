using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopItemWithdrawnEvent(Guid EventId, Guid PublicPawnshopId, Guid PublicStockItemId, Guid UserId, string Name, string Rarity, decimal Price) : INotification;
