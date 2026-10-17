using MediatR;

namespace AuctionServer.Shared.Integration.Events.Casino;

public record CasinoChipPurchaseRejectedEvent(Guid EventId, Guid PublicPurchaseId, Guid UserId, string Reason) : INotification;
