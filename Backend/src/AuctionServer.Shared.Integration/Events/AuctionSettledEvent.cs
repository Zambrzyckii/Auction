using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record AuctionSettledEvent(Guid EventId, Guid PublicAuctionId, Guid SellerUserId, Guid WinnerUserId, decimal FinalPrice) : INotification;
