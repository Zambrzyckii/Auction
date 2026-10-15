using MediatR;

namespace AuctionServer.Shared.Integration.Events.Auctions;

public record AuctionActivatedEvent(Guid EventId, Guid PublicAuctionId, Guid SellerUserId, Guid PublicItemId, string ItemName, string ItemRarity, decimal ItemOfficialPrice, decimal CurrentPrice, DateTime EndsOn) : INotification;
