using MediatR;

namespace AuctionServer.Shared.Integration.Events.Items;

public record ItemSoldToShopEvent(Guid EventId, Guid PublicItemId, Guid OwnerUserId, decimal Price) : INotification;