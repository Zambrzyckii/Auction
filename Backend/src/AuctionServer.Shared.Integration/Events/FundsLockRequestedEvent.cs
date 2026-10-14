using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record FundsLockRequestedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId, decimal Amount) : INotification;