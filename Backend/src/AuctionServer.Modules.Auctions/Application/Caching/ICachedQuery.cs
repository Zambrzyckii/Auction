using AuctionServer.Modules.Auctions.Application.Options;

namespace AuctionServer.Modules.Auctions.Application.Caching;

public interface ICachedQuery
{
    string CacheKey { get; }

    TimeSpan GetTtl(AuctionReadCacheOptions options);
}
