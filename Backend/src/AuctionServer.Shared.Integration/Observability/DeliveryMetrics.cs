using System.Diagnostics.Metrics;

namespace AuctionServer.Shared.Integration.Observability;

public static class DeliveryMetrics
{
    public const string MeterName = "AuctionServer.Delivery";

    private static readonly Meter Meter = new(MeterName);

    private static readonly Counter<long> Processed =
        Meter.CreateCounter<long>("auctionserver.delivery.processed", "{messages}");

    private static readonly Counter<long> Failed =
        Meter.CreateCounter<long>("auctionserver.delivery.failed", "{attempts}");

    private static readonly Counter<long> Dead =
        Meter.CreateCounter<long>("auctionserver.delivery.dead", "{messages}");

    private static readonly Histogram<double> DeliveryLag =
        Meter.CreateHistogram<double>("auctionserver.delivery.lag", "s", null, advice: new InstrumentAdvice<double> { HistogramBucketBoundaries = [1,3,5,11,21,41,81,161,321,600]});

    public static void RecordProcessed(string recipient, TimeSpan lag)
    {
        Processed.Add(1, RecipientTag(recipient));
        DeliveryLag.Record(lag.TotalSeconds, RecipientTag(recipient));
    }

    public static void RecordFailed(string recipient) => Failed.Add(1, RecipientTag(recipient));

    public static void RecordDead(string recipient) => Dead.Add(1, RecipientTag(recipient));

    private static KeyValuePair<string, object?> RecipientTag(string recipient) => new("delivery.recipient", recipient);
}
