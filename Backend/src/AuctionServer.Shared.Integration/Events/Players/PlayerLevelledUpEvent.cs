using MediatR;

namespace AuctionServer.Shared.Integration.Events.Players;

public record PlayerLevelledUpEvent(Guid EventId, Guid UserId, int PreviousLevel, int NewLevel, decimal RewardAmount)
    : INotification;
