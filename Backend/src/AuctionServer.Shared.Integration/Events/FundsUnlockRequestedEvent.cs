using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record FundsUnlockRequestedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId) : INotification;
