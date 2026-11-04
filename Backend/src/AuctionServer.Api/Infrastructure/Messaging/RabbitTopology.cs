using RabbitMQ.Client;

namespace AuctionServer.Api.Infrastructure.Messaging;

public static class RabbitTopology
{
    public const string EventsExchange = "auctionserver.events";
    public const string DeliveriesQueue = "auctionserver.deliveries";
    public const string DeliveryRoutingKey = "delivery";

    public static async Task DeclareAsync(IChannel channel, CancellationToken token)
    {
        await channel.ExchangeDeclareAsync(EventsExchange, ExchangeType.Direct,
            durable: true, autoDelete: false, cancellationToken: token);
        await channel.QueueDeclareAsync(DeliveriesQueue,
            durable: true, exclusive: false, autoDelete: false, cancellationToken: token);
        await channel.QueueBindAsync(DeliveriesQueue, EventsExchange, DeliveryRoutingKey, cancellationToken: token);
    }
}
