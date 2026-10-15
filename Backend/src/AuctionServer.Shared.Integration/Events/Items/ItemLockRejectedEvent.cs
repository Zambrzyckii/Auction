using MediatR;

namespace AuctionServer.Shared.Integration.Events.Items;

public record ItemLockRejectedEvent(Guid EventId, Guid PublicAuctionId, Guid PublicItemId, string Reason) : INotification;
