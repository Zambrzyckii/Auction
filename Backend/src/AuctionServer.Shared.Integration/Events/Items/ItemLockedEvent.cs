using MediatR;

namespace AuctionServer.Shared.Integration.Events.Items;

public record ItemLockedEvent(Guid EventId, Guid PublicAuctionId, Guid PublicItemId, string ItemName, string ItemRarity, decimal OfficialPrice) : INotification;
