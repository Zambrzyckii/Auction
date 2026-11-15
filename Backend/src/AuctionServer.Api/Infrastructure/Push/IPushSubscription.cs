using System.Threading.Channels;

namespace AuctionServer.Api.Infrastructure.Push;

public interface IPushSubscription : IDisposable
{
    ChannelReader<PushMessage> Reader { get; }
}
