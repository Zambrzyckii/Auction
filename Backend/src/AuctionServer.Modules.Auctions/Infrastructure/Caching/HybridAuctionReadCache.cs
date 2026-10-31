using AuctionServer.Modules.Auctions.Application.Caching;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Auctions.Infrastructure.Caching;

public sealed class HybridAuctionReadCache(HybridCache cache, ILogger<HybridAuctionReadCache> logger)
    : IAuctionReadCache
{
    public async Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl,
        CancellationToken cancellationToken)
    {
        var entryOptions = new HybridCacheEntryOptions()
        {
            Expiration = ttl,
            LocalCacheExpiration = ttl
        };

        Exception? factoryException = null;

        try
        {
            return await cache.GetOrCreateAsync(
                key,
                async ct =>
                {
                    try
                    {
                        return await factory(ct);
                    }
                    catch (Exception exception)
                    {
                        factoryException = exception;
                        throw;
                    }
                },
                entryOptions,
                cancellationToken: cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (!ReferenceEquals(exception, factoryException))
        {
            logger.LogWarning(exception, "Read cache failed for key {CacheKey}, falling back to source", key);
            return await factory(cancellationToken);
        }
    }
}
