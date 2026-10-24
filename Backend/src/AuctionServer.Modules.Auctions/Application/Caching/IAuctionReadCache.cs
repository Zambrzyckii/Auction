namespace AuctionServer.Modules.Auctions.Application.Caching;

public interface IAuctionReadCache
{
    Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl,
        CancellationToken cancellationToken);
}
