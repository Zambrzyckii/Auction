using MediatR;

namespace AuctionServer.Shared.Integration.Events.Funds;

public record FundsLockRejectedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId, string Reason) : INotification;