using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record FundsLockRejectedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId, string Reason) : INotification;