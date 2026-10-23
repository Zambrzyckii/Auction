using System.Diagnostics.Metrics;
using AuctionServer.Api.Infrastructure.Messaging;
using AuctionServer.Shared.Integration.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.Metrics.Testing;

namespace AuctionServer.Api.Tests.Messaging;

public class InstrumentedEventPublisherTests
{
    private sealed class RecordingPublisher : IIntegrationEventPublisher
    {
        public int Calls { get; private set; }

        public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token)
        {
            Calls++;
            return Task.CompletedTask;
        }
    }

    private sealed class FailingPublisher : IIntegrationEventPublisher
    {
        public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token) =>
            throw new InvalidOperationException("publish failed");
    }

    private static (IMeterFactory MeterFactory, MessagingMetrics Metrics) CreateMetrics()
    {
        var provider = new ServiceCollection().AddMetrics().BuildServiceProvider();
        var meterFactory = provider.GetRequiredService<IMeterFactory>();
        return (meterFactory, new MessagingMetrics(meterFactory));
    }

    [Fact]
    public async Task PublishAsync_WhenInnerSucceeds_ShouldDelegateAndCountOk()
    {
        var (meterFactory, metrics) = CreateMetrics();
        var inner = new RecordingPublisher();
        var publisher = new InstrumentedEventPublisher(inner, metrics);
        using var collector = new MetricCollector<long>(
            meterFactory, MessagingMetrics.MeterName, "auctionserver.messaging.published");

        await publisher.PublishAsync(Guid.NewGuid(), "BidPlacedEvent", "{}", CancellationToken.None);

        Assert.Equal(1, inner.Calls);
        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.Equal(1, measurement.Value);
        Assert.Equal("BidPlacedEvent", measurement.Tags["event.type"]);
        Assert.Equal("ok", measurement.Tags["result"]);
    }

    [Fact]
    public async Task PublishAsync_WhenInnerThrows_ShouldCountErrorAndRethrow()
    {
        var (meterFactory, metrics) = CreateMetrics();
        var publisher = new InstrumentedEventPublisher(new FailingPublisher(), metrics);
        using var collector = new MetricCollector<long>(
            meterFactory, MessagingMetrics.MeterName, "auctionserver.messaging.published");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            publisher.PublishAsync(Guid.NewGuid(), "BidPlacedEvent", "{}", CancellationToken.None));

        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.Equal(1, measurement.Value);
        Assert.Equal("BidPlacedEvent", measurement.Tags["event.type"]);
        Assert.Equal("error", measurement.Tags["result"]);
    }

    [Fact]
    public async Task PublishAsync_WhenInnerThrows_ShouldNotRecordDuration()
    {
        var (meterFactory, metrics) = CreateMetrics();
        var publisher = new InstrumentedEventPublisher(new FailingPublisher(), metrics);
        using var collector = new MetricCollector<double>(
            meterFactory, MessagingMetrics.MeterName, "auctionserver.messaging.publish.duration");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            publisher.PublishAsync(Guid.NewGuid(), "BidPlacedEvent", "{}", CancellationToken.None));

        Assert.Empty(collector.GetMeasurementSnapshot());
    }

    [Fact]
    public async Task PublishAsync_WhenInnerSucceeds_ShouldRecordDuration()
    {
        var (meterFactory, metrics) = CreateMetrics();
        var publisher = new InstrumentedEventPublisher(new RecordingPublisher(), metrics);
        using var collector = new MetricCollector<double>(
            meterFactory, MessagingMetrics.MeterName, "auctionserver.messaging.publish.duration");

        await publisher.PublishAsync(Guid.NewGuid(), "BidPlacedEvent", "{}", CancellationToken.None);

        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.True(measurement.Value >= 0);
    }
}
