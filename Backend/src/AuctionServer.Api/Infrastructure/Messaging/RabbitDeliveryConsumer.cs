using AuctionServer.Shared.Infrastructure.Delivery;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AuctionServer.Api.Infrastructure.Messaging;

public sealed class RabbitDeliveryConsumer(
    MessagingRabbitOptions options,
    IServiceScopeFactory scopeFactory,
    ILogger<RabbitDeliveryConsumer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConsumeUntilConnectionLossAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Rabbit delivery consumer failed, reconnecting in 5 s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task ConsumeUntilConnectionLossAsync(CancellationToken token)
    {
        var factory = new ConnectionFactory
        {
            HostName = options.HostName,
            Port = options.Port,
            UserName = options.UserName,
            Password = options.Password
        };
        await using var connection = await factory.CreateConnectionAsync(token);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: token);
        await RabbitTopology.DeclareAsync(channel, token);
        await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 20, global: false, token);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, delivery) => HandleAsync(channel, delivery, token);
        await channel.BasicConsumeAsync(RabbitTopology.DeliveriesQueue, autoAck: false, consumer, token);

        while (connection.IsOpen) await Task.Delay(TimeSpan.FromSeconds(5), token);
        throw new InvalidOperationException("Rabbit connection lost");
    }

    private async Task HandleAsync(IChannel channel, BasicDeliverEventArgs delivery, CancellationToken token)
    {
        try
        {
            var messageId = Guid.Parse(delivery.BasicProperties.MessageId!);
            var type = delivery.BasicProperties.Type!;
            var content = System.Text.Encoding.UTF8.GetString(delivery.Body.Span);

            await using var scope = scopeFactory.CreateAsyncScope();
            var dispatcher = scope.ServiceProvider.GetRequiredService<IIntegrationEventDispatcher>();
            await dispatcher.AcceptAsync(messageId, type, content, token);

            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, token);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Accepting delivery message failed");
            await Task.Delay(TimeSpan.FromSeconds(5), token);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true, token);
        }
    }
}
