using System.Diagnostics.Metrics;

namespace AuctionServer.Api.Infrastructure.Messaging;

public sealed class MessagingMetrics
{
    public const string MeterName = "AuctionServer.Messaging";

    public MessagingMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create(MeterName);
        Published = meter.CreateCounter<long>("auctionserver.messaging.published", "{messages}");
        PublishDuration = meter.CreateHistogram<double>("auctionserver.messaging.publish.duration", "ms");
    }

    public Counter<long> Published { get; }

    public Histogram<double> PublishDuration { get; }
}
