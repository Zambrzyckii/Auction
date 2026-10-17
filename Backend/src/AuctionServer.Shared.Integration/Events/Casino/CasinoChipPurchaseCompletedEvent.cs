using MediatR;

namespace AuctionServer.Shared.Integration.Events.Casino;

public record CasinoChipPurchaseCompletedEvent(Guid EventId, Guid PublicPurchaseId, Guid UserId) : INotification;
