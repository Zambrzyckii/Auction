using System.Diagnostics.Metrics;

namespace AuctionServer.Modules.Auctions.Infrastructure.Caching;

public sealed class AuctionCacheMetrics
{
    public const string MeterName = "AuctionServer.Auctions.Cache";

    private readonly Counter<long> _hits;
    private readonly Counter<long> _misses;
    private readonly Counter<long> _errors;

    public AuctionCacheMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create(MeterName);
        _hits = meter.CreateCounter<long>("auctions.cache.hits");
        _misses = meter.CreateCounter<long>("auctions.cache.misses");
        _errors = meter.CreateCounter<long>("auctions.cache.errors");
    }

    public void RecordHit() => _hits.Add(1);

    public void RecordMiss() => _misses.Add(1);

    public void RecordError() => _errors.Add(1);
}
