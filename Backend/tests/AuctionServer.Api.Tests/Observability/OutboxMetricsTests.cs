using AuctionServer.Shared.Integration.Observability;
using Microsoft.Extensions.Diagnostics.Metrics.Testing;

namespace AuctionServer.Api.Tests.Observability;

public class OutboxMetricsTests
{
    [Fact]
    public void RecordProcessed_ShouldCountAndRecordLagWithModuleTag()
    {
        using var processed = new MetricCollector<long>(
            null, OutboxMetrics.MeterName, "auctionserver.outbox.processed");
        using var lag = new MetricCollector<double>(
            null, OutboxMetrics.MeterName, "auctionserver.outbox.publish.lag");

        OutboxMetrics.RecordProcessed("Wallets", TimeSpan.FromSeconds(4));

        var count = Assert.Single(processed.GetMeasurementSnapshot());
        Assert.Equal(1, count.Value);
        Assert.Equal("Wallets", count.Tags["outbox.module"]);
        var lagMeasurement = Assert.Single(lag.GetMeasurementSnapshot());
        Assert.Equal(4, lagMeasurement.Value);
        Assert.Equal("Wallets", lagMeasurement.Tags["outbox.module"]);
    }

    [Fact]
    public void RecordFailed_ShouldCountWithModuleTag()
    {
        using var failed = new MetricCollector<long>(
            null, OutboxMetrics.MeterName, "auctionserver.outbox.failed");

        OutboxMetrics.RecordFailed("Auctions");

        var measurement = Assert.Single(failed.GetMeasurementSnapshot());
        Assert.Equal(1, measurement.Value);
        Assert.Equal("Auctions", measurement.Tags["outbox.module"]);
    }

    [Fact]
    public void RecordDead_ShouldCountWithModuleTag()
    {
        using var dead = new MetricCollector<long>(
            null, OutboxMetrics.MeterName, "auctionserver.outbox.dead");

        OutboxMetrics.RecordDead("Banking");

        var measurement = Assert.Single(dead.GetMeasurementSnapshot());
        Assert.Equal(1, measurement.Value);
        Assert.Equal("Banking", measurement.Tags["outbox.module"]);
    }
}
