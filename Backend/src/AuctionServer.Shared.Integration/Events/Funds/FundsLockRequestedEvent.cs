using MediatR;

namespace AuctionServer.Shared.Integration.Events.Funds;

public record FundsLockRequestedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId, decimal Amount) : INotification;