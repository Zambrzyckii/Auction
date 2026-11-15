namespace AuctionServer.Api.Infrastructure.Push;

public sealed record PushOptions(TimeSpan Heartbeat, int BufferSize, int MaxStreamsPerUser)
{
    public static readonly PushOptions Default = new(TimeSpan.FromSeconds(15), 64, 4);
}
