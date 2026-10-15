using MediatR;

namespace AuctionServer.Shared.Integration.Events.Funds;

public record FundsUnlockRequestedEvent(Guid EventId, Guid PublicAuctionId, Guid BidderUserId) : INotification;
