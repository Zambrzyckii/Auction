using AuctionServer.Shared.Integration.Events.Players;
using MediatR;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

public sealed class DeliveryLog
{
    public List<string> Entries { get; } = [];
}

public sealed class FirstRecipientHandler(DeliveryLog log) : INotificationHandler<PlayerLevelledUpEvent>
{
    public Task Handle(PlayerLevelledUpEvent notification, CancellationToken cancellationToken)
    {
        log.Entries.Add("First");
        return Task.CompletedTask;
    }
}

public sealed class SecondRecipientHandler(DeliveryLog log) : INotificationHandler<PlayerLevelledUpEvent>
{
    public Task Handle(PlayerLevelledUpEvent notification, CancellationToken cancellationToken)
    {
        log.Entries.Add("Second");
        return Task.CompletedTask;
    }
}

public sealed class FailingRecipientHandler : INotificationHandler<PlayerLevelledUpEvent>
{
    public Task Handle(PlayerLevelledUpEvent notification, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("recipient failure");
}
