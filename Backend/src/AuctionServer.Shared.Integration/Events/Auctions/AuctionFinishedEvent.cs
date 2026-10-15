using MediatR;

namespace AuctionServer.Shared.Integration.Events.Auctions;

public record AuctionFinishedEvent (Guid EventId, Guid PublicAuctionId, Guid SellerUserId, Guid? WinnerUserId, decimal? FinalPrice) : INotification;