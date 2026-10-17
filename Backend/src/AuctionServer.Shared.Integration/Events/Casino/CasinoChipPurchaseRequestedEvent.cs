using MediatR;

namespace AuctionServer.Shared.Integration.Events.Casino;

public record CasinoChipPurchaseRequestedEvent(Guid EventId, Guid PublicPurchaseId, Guid UserId, decimal Amount) : INotification;
