using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record BidPlacedEvent(Guid EventId, Guid PublicAuctionId, Guid NewWinningUserId, Guid? PreviousWinningUserId, decimal NewPrice, decimal? PreviousPrice) : INotification;
