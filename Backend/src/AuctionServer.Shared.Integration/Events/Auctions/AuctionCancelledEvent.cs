using MediatR;

namespace AuctionServer.Shared.Integration.Events.Auctions;

public record AuctionCancelledEvent(Guid EventId, Guid PublicAuctionId, Guid PublicItemId, string Reason) : INotification;