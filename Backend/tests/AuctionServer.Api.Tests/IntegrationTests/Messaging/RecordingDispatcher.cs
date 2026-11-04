using System.Collections.Concurrent;
using AuctionServer.Shared.Infrastructure.Delivery;

namespace AuctionServer.Api.Tests.IntegrationTests.Messaging;

public sealed class RecordingDispatcher(int failuresBeforeSuccess = 0) : IIntegrationEventDispatcher
{
    private readonly ConcurrentQueue<(Guid MessageId, string Type, string Content)> _accepted = new();
    private int _failuresLeft = failuresBeforeSuccess;

    public IReadOnlyCollection<(Guid MessageId, string Type, string Content)> Accepted => _accepted;

    public Task AcceptAsync(Guid messageId, string type, string content, CancellationToken token)
    {
        if (Interlocked.Decrement(ref _failuresLeft) >= 0)
            throw new InvalidOperationException("Simulated dispatcher failure");

        _accepted.Enqueue((messageId, type, content));
        return Task.CompletedTask;
    }
}
