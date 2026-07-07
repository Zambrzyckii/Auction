using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Events;

public record BidPlacedEvent (Guid PublicAuctionId, decimal NewPrice) : INotification;