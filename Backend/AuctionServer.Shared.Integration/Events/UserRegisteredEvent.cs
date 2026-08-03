using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record UserRegisteredEvent(Guid PublicUserId, string Email) : INotification;