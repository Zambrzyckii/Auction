using System.Diagnostics.Metrics;

namespace AuctionServer.Shared.Integration.Observability;

public static class OutboxMetrics
{
    public const string MeterName = "AuctionServer.Outbox";

    private static readonly Meter Meter = new(MeterName);

    private static readonly Counter<long> Processed =
        Meter.CreateCounter<long>("auctionserver.outbox.processed", "{messages}");

    private static readonly Counter<long> Failed =
        Meter.CreateCounter<long>("auctionserver.outbox.failed", "{attempts}");

    private static readonly Counter<long> Dead =
        Meter.CreateCounter<long>("auctionserver.outbox.dead", "{messages}");

    private static readonly Histogram<double> PublishLag =
        Meter.CreateHistogram<double>("auctionserver.outbox.publish.lag", "s", null, advice: new InstrumentAdvice<double> { HistogramBucketBoundaries = [1,3,5,11,21,41,81,161,321,600]});

    public static void RecordProcessed(string module, TimeSpan lag)
    {
        Processed.Add(1, ModuleTag(module));
        PublishLag.Record(lag.TotalSeconds, ModuleTag(module));
    }

    public static void RecordFailed(string module) => Failed.Add(1, ModuleTag(module));

    public static void RecordDead(string module) => Dead.Add(1, ModuleTag(module));

    private static KeyValuePair<string, object?> ModuleTag(string module) => new("outbox.module", module);
}
