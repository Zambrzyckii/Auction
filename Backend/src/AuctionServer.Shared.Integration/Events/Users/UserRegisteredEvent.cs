using MediatR;

namespace AuctionServer.Shared.Integration.Events.Users;

public record UserRegisteredEvent(Guid EventId, Guid PublicUserId, string Email, string? Username = null) : INotification;
