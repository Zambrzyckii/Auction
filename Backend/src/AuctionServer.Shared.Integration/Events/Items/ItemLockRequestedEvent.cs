using MediatR;

namespace AuctionServer.Shared.Integration.Events.Items;

public record ItemLockRequestedEvent(Guid EventId, Guid PublicAuctionId, Guid PublicItemId, Guid SellerUserId) : INotification;
