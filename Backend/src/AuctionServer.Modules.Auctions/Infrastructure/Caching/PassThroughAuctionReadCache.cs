using AuctionServer.Modules.Auctions.Application.Caching;

namespace AuctionServer.Modules.Auctions.Infrastructure.Caching;

public sealed class PassThroughAuctionReadCache : IAuctionReadCache
{
    public Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl,
        CancellationToken cancellationToken) => factory(cancellationToken);
}
