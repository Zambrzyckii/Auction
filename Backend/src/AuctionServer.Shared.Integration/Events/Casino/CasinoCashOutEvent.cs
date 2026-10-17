using MediatR;

namespace AuctionServer.Shared.Integration.Events.Casino;

public record CasinoCashOutEvent(Guid EventId, Guid UserId, decimal Amount) : INotification;
