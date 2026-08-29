using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record AuctionActivatedEvent(Guid EventId, Guid PublicAuctionId, Guid SellerUserId, Guid PublicItemId, string ItemName, string ItemRarity, decimal ItemOfficialPrice, decimal CurrentPrice, DateTime EndsOn) : INotification;
