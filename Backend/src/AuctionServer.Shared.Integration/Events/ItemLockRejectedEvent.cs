using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record ItemLockRejectedEvent(Guid EventId, Guid PublicAuctionId, Guid PublicItemId, string Reason) : INotification;
