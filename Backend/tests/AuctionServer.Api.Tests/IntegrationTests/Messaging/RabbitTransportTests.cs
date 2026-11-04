using AuctionServer.Api.Infrastructure.Messaging;
using AuctionServer.Shared.Infrastructure.Delivery;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace AuctionServer.Api.Tests.IntegrationTests.Messaging;

[Collection(RabbitMqCollection.Name)]
public class RabbitTransportTests(RabbitMqFixture fixture)
{
    [Fact]
    public async Task PublishAsync_ShouldReachTheDispatcherThroughTheBroker()
    {
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
    public async Task PublishAsync_WhenTheDispatcherFailsOnce_ShouldRedeliverTheMessage()
    {
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
