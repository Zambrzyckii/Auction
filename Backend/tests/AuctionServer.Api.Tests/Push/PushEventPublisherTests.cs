using System.Text.Json;
using AuctionServer.Api.Infrastructure.Push;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace AuctionServer.Api.Tests.Push;

public class PushEventPublisherTests
{
    private sealed class RecordingPublisher : IIntegrationEventPublisher
    {
        public List<(Guid MessageId, string Type)> Calls { get; } = [];

        public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token)
        {
            Calls.Add((messageId, type));
            return Task.CompletedTask;
        }
    }

    private sealed class FailingPublisher : IIntegrationEventPublisher
    {
        public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token) =>
            throw new InvalidOperationException("publish failed");
    }

    private static readonly Guid Bidder = Guid.NewGuid();
    private static readonly BidPlacedEvent Bid = new(Guid.NewGuid(), Guid.NewGuid(), Bidder, null, 20m, null);

    private static (PushEventPublisher Publisher, IPushSubscription Stream, FakeLogger<PushEventPublisher> Logger) Create(
        IIntegrationEventPublisher inner)
    {
        var connections = new PushConnections(PushOptions.Default);
        var logger = new FakeLogger<PushEventPublisher>();
        var publisher = new PushEventPublisher(inner, PushRoutes.Build(), connections, logger);
        return (publisher, connections.Subscribe(Bidder), logger);
    }

    [Fact]
    public async Task PublishAsync_ShouldPublishThroughInnerAndThenNudge()
    {
        var inner = new RecordingPublisher();
        var (publisher, stream, _) = Create(inner);
        var messageId = Guid.NewGuid();

        await publisher.PublishAsync(messageId, nameof(BidPlacedEvent), JsonSerializer.Serialize(Bid), CancellationToken.None);

        Assert.Equal((messageId, nameof(BidPlacedEvent)), Assert.Single(inner.Calls));
        Assert.True(stream.Reader.TryRead(out var message));
        Assert.Equal(PushTopics.AuctionChanged, message.Topic);
        Assert.Contains(Bid.PublicAuctionId.ToString(), message.Data);
    }

    [Fact]
    public async Task PublishAsync_WhenInnerThrows_ShouldPropagateAndSendNothing()
    {
        var (publisher, stream, _) = Create(new FailingPublisher());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            publisher.PublishAsync(Guid.NewGuid(), nameof(BidPlacedEvent), JsonSerializer.Serialize(Bid), CancellationToken.None));

        Assert.False(stream.Reader.TryRead(out _));
    }

    [Fact]
    public async Task PublishAsync_WithMalformedContent_ShouldLogAndKeepThePublicationSuccessful()
    {
        var inner = new RecordingPublisher();
        var (publisher, stream, logger) = Create(inner);

        await publisher.PublishAsync(Guid.NewGuid(), nameof(BidPlacedEvent), "not json", CancellationToken.None);

        Assert.Single(inner.Calls);
        Assert.False(stream.Reader.TryRead(out _));
        var record = Assert.Single(logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Warning, record.Level);
        Assert.Contains(nameof(BidPlacedEvent), record.Message);
    }

    [Fact]
    public async Task PublishAsync_WithUnknownType_ShouldLogAndSendNothing()
    {
        var inner = new RecordingPublisher();
        var (publisher, stream, logger) = Create(inner);

        await publisher.PublishAsync(Guid.NewGuid(), "MysteryEvent", "{}", CancellationToken.None);

        Assert.Single(inner.Calls);
        Assert.False(stream.Reader.TryRead(out _));
        Assert.Single(logger.Collector.GetSnapshot());
    }
}
