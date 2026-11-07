using AuctionServer.Api.Infrastructure.Messaging;
using AuctionServer.Shared.Infrastructure.Delivery;
using AuctionServer.Shared.Integration.Events.Auctions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AuctionServer.Api.Tests.IntegrationTests.Messaging;

[Collection(RabbitMqCollection.Name)]
public class RabbitTransportTests(RabbitMqFixture fixture)
{
    [Fact]
    public async Task PublishAsync_ShouldReachTheDispatcherThroughTheBroker()
    {
        await PurgeDeliveriesAsync();
        var dispatcher = new RecordingDispatcher();
        await using var provider = BuildProvider(dispatcher);
        var consumer = BuildConsumer(provider);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await using var publisher = new RabbitEventPublisher(fixture.Options);
            var messageId = Guid.NewGuid();
            await publisher.PublishAsync(messageId, "TestEvent", """{"value":1}""", CancellationToken.None);

            Assert.True(await WaitForAsync(() => dispatcher.Accepted.Count >= 1, TimeSpan.FromSeconds(15)),
                "the published message never reached the dispatcher");
            var message = Assert.Single(dispatcher.Accepted);
            Assert.Equal(messageId, message.MessageId);
            Assert.Equal("TestEvent", message.Type);
            Assert.Equal("""{"value":1}""", message.Content);
        }
        finally
        {
            await consumer.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task PublishAsync_WhenTheBrokerIsUnreachable_ShouldThrowTransportUnavailable()
    {
        var unreachable = new MessagingRabbitOptions
        {
            HostName = "127.0.0.1",
            Port = 1,
            UserName = "auction",
            Password = "wrong"
        };
        await using var publisher = new RabbitEventPublisher(unreachable);

        await Assert.ThrowsAsync<AuctionServer.Shared.Integration.Messaging.TransportUnavailableException>(
            () => publisher.PublishAsync(Guid.NewGuid(), "TestEvent", "{}", CancellationToken.None));
    }

    [Fact]
    public async Task PublishAsync_WhenTheDispatcherFailsOnce_ShouldRedeliverTheMessage()
    {
        await PurgeDeliveriesAsync();
        var dispatcher = new RecordingDispatcher(failuresBeforeSuccess: 1);
        await using var provider = BuildProvider(dispatcher);
        var consumer = BuildConsumer(provider);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await using var publisher = new RabbitEventPublisher(fixture.Options);
            var messageId = Guid.NewGuid();
            await publisher.PublishAsync(messageId, "RetriedEvent", """{"value":2}""", CancellationToken.None);

            Assert.True(await WaitForAsync(() => dispatcher.Accepted.Count >= 1, TimeSpan.FromSeconds(30)),
                "the redelivered message never reached the dispatcher");
            var message = Assert.Single(dispatcher.Accepted);
            Assert.Equal(messageId, message.MessageId);
            Assert.Equal("RetriedEvent", message.Type);
        }
        finally
        {
            await consumer.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task PublishAsync_WhenTheEventIsPublic_ShouldCopyItToTheMarketExchange()
    {
        await using var connection = await OpenConnectionAsync();
        await using var channel = await connection.CreateChannelAsync();
        await RabbitTopology.DeclareAsync(channel, CancellationToken.None);
        var queue = (await channel.QueueDeclareAsync()).QueueName;
        await channel.QueueBindAsync(queue, RabbitTopology.MarketExchange, nameof(BidPlacedEvent));

        var received = new TaskCompletionSource<(string? MessageId, string? Type, string Content)>();
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, delivery) =>
        {
            received.TrySetResult((delivery.BasicProperties.MessageId, delivery.BasicProperties.Type,
                System.Text.Encoding.UTF8.GetString(delivery.Body.Span)));
            return Task.CompletedTask;
        };
        await channel.BasicConsumeAsync(queue, autoAck: true, consumer);

        await using var publisher = new RabbitEventPublisher(fixture.Options);
        var messageId = Guid.NewGuid();
        await publisher.PublishAsync(messageId, nameof(BidPlacedEvent), """{"amount":100}""", CancellationToken.None);

        var message = await received.Task.WaitAsync(TimeSpan.FromSeconds(15));
        Assert.Equal(messageId.ToString(), message.MessageId);
        Assert.Equal(nameof(BidPlacedEvent), message.Type);
        Assert.Equal("""{"amount":100}""", message.Content);
    }

    [Fact]
    public async Task PublishAsync_WhenTheEventIsInternal_ShouldNotReachTheMarketExchange()
    {
        await using var connection = await OpenConnectionAsync();
        await using var channel = await connection.CreateChannelAsync();
        await RabbitTopology.DeclareAsync(channel, CancellationToken.None);
        var queue = (await channel.QueueDeclareAsync()).QueueName;
        await channel.QueueBindAsync(queue, RabbitTopology.MarketExchange, "#");

        var received = 0;
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, _) =>
        {
            Interlocked.Increment(ref received);
            return Task.CompletedTask;
        };
        await channel.BasicConsumeAsync(queue, autoAck: true, consumer);

        await using var publisher = new RabbitEventPublisher(fixture.Options);
        await publisher.PublishAsync(Guid.NewGuid(), "FundsLockRequestedEvent", """{"value":3}""", CancellationToken.None);

        await Task.Delay(TimeSpan.FromSeconds(1));
        Assert.Equal(0, received);
    }

    private async Task<IConnection> OpenConnectionAsync()
    {
        var factory = new ConnectionFactory
        {
            HostName = fixture.Options.HostName,
            Port = fixture.Options.Port,
            UserName = fixture.Options.UserName,
            Password = fixture.Options.Password
        };
        return await factory.CreateConnectionAsync();
    }

    private async Task PurgeDeliveriesAsync()
    {
        await using var connection = await OpenConnectionAsync();
        await using var channel = await connection.CreateChannelAsync();
        await RabbitTopology.DeclareAsync(channel, CancellationToken.None);
        await channel.QueuePurgeAsync(RabbitTopology.DeliveriesQueue);
    }

    private RabbitDeliveryConsumer BuildConsumer(ServiceProvider provider) => new(
        fixture.Options,
        provider.GetRequiredService<IServiceScopeFactory>(),
        NullLogger<RabbitDeliveryConsumer>.Instance);

    private static ServiceProvider BuildProvider(IIntegrationEventDispatcher dispatcher) =>
        new ServiceCollection().AddSingleton(dispatcher).BuildServiceProvider();

    private static async Task<bool> WaitForAsync(Func<bool> condition, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (condition()) return true;
            await Task.Delay(TimeSpan.FromMilliseconds(100));
        }

        return condition();
    }
}
