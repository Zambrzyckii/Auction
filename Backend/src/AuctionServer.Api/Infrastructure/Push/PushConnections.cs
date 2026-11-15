using System.Threading.Channels;

namespace AuctionServer.Api.Infrastructure.Push;

public sealed class PushConnections(PushOptions options)
{
    private readonly object _gate = new();
    private readonly Dictionary<Guid, List<Subscription>> _byUser = [];
    private long _sequence;

    public int StreamCount
    {
        get
        {
            lock (_gate) return _byUser.Values.Sum(list => list.Count);
        }
    }

    public IPushSubscription Subscribe(Guid userId)
    {
        Subscription? evicted = null;
        var subscription = new Subscription(this, userId, options.BufferSize, Interlocked.Increment(ref _sequence));
        lock (_gate)
        {
            if (!_byUser.TryGetValue(userId, out var streams))
            {
                streams = [];
                _byUser[userId] = streams;
            }
            if (streams.Count >= options.MaxStreamsPerUser)
            {
                evicted = streams.MinBy(s => s.Sequence);
                streams.Remove(evicted!);
            }
            streams.Add(subscription);
        }
        evicted?.Complete();
        return subscription;
    }

    public void SendToUser(Guid userId, PushMessage message)
    {
        foreach (var subscription in Snapshot(userId)) subscription.Write(message);
    }

    public void Broadcast(PushMessage message)
    {
        foreach (var subscription in Snapshot()) subscription.Write(message);
    }

    private List<Subscription> Snapshot(Guid userId)
    {
        lock (_gate) return _byUser.TryGetValue(userId, out var streams) ? [.. streams] : [];
    }

    private List<Subscription> Snapshot()
    {
        lock (_gate) return _byUser.Values.SelectMany(streams => streams).ToList();
    }

    private void Remove(Subscription subscription)
    {
        lock (_gate)
        {
            if (!_byUser.TryGetValue(subscription.UserId, out var streams)) return;
            streams.Remove(subscription);
            if (streams.Count == 0) _byUser.Remove(subscription.UserId);
        }
    }

    private sealed class Subscription(PushConnections owner, Guid userId, int bufferSize, long sequence) : IPushSubscription
    {
        private readonly Channel<PushMessage> _channel = Channel.CreateBounded<PushMessage>(
            new BoundedChannelOptions(bufferSize)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = false
            });

        public Guid UserId => userId;
        public long Sequence => sequence;
        public ChannelReader<PushMessage> Reader => _channel.Reader;

        public void Write(PushMessage message) => _channel.Writer.TryWrite(message);

        public void Complete() => _channel.Writer.TryComplete();

        public void Dispose()
        {
            owner.Remove(this);
            Complete();
        }
    }
}
