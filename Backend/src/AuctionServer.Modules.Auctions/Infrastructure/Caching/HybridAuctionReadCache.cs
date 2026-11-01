using AuctionServer.Modules.Auctions.Application.Caching;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Auctions.Infrastructure.Caching;

public sealed class HybridAuctionReadCache(
    HybridCache cache,
    AuctionCacheMetrics metrics,
    ILogger<HybridAuctionReadCache> logger) : IAuctionReadCache
{
    public async Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl,
        CancellationToken cancellationToken)
    {
        var entryOptions = new HybridCacheEntryOptions
        {
            Expiration = ttl,
            LocalCacheExpiration = ttl
        };

        Exception? factoryException = null;
        var factoryInvoked = false;

        try
        {
            var value = await cache.GetOrCreateAsync(
                key,
                async ct =>
                {
                    factoryInvoked = true;
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
            if (factoryInvoked)
                metrics.RecordMiss();
            else
                metrics.RecordHit();
            return value;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (!ReferenceEquals(exception, factoryException))
        {
            metrics.RecordError();
            logger.LogWarning(exception, "Read cache failed for key {CacheKey}, falling back to source", key);
            return await factory(cancellationToken);
        }
    }
}
