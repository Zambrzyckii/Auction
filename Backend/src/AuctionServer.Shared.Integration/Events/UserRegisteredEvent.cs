using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record UserRegisteredEvent(Guid EventId, Guid PublicUserId, string Email) : INotification;
