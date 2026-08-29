using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record ItemLockRequestedEvent(Guid EventId, Guid PublicAuctionId, Guid PublicItemId, Guid SellerUserId) : INotification;
