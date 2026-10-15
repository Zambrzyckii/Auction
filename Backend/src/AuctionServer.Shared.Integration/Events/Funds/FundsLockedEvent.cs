using MediatR;

namespace AuctionServer.Shared.Integration.Events.Funds;

public record FundsLockedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId, decimal Amount) : INotification;