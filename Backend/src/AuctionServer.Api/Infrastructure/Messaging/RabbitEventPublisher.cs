using System.Net.Sockets;
using AuctionServer.Shared.Integration.Messaging;
using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;

namespace AuctionServer.Api.Infrastructure.Messaging;

public sealed class RabbitEventPublisher(MessagingRabbitOptions options) : IIntegrationEventPublisher, IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IConnection? _connection;
    private IChannel? _channel;

    public async Task PublishAsync(Guid messageId, string type, string content, CancellationToken token)
    {
        await _gate.WaitAsync(token);
        try
        {
            var channel = await EnsureChannelAsync(token);

            var properties = new BasicProperties
            {
                MessageId = messageId.ToString(),
                Type = type,
                ContentType = "application/json",
                Persistent = true
            };

            var body = System.Text.Encoding.UTF8.GetBytes(content);
            await channel.BasicPublishAsync(RabbitTopology.EventsExchange, RabbitTopology.DeliveryRoutingKey,
                mandatory: false, properties, body, token);

            if (MarketEvents.Published.Contains(type))
                await channel.BasicPublishAsync(RabbitTopology.MarketExchange, routingKey: type,
                    mandatory: false, properties, body, token);
        }
        catch (Exception e) when (IsBrokerUnavailable(e))
        {
            throw new TransportUnavailableException(
                $"RabbitMQ at '{options.HostName}:{options.Port}' is unavailable", e);
        }
        finally
        {
            _gate.Release();
        }
    }

    private static bool IsBrokerUnavailable(Exception exception) =>
        exception is 
            BrokerUnreachableException 
            or ConnectFailureException or AlreadyClosedException
            or OperationInterruptedException
            or IOException or SocketException;

    private async Task<IChannel> EnsureChannelAsync(CancellationToken token)
    {
        if (_channel is { IsOpen: true }) return _channel;

        if (_channel is not null) await _channel.DisposeAsync();
        if (_connection is not { IsOpen: true })
        {
            if (_connection is not null) await _connection.DisposeAsync();
            var factory = new ConnectionFactory
            {
                HostName = options.HostName,
                Port = options.Port,
                UserName = options.UserName,
                Password = options.Password
            };
            _connection = await factory.CreateConnectionAsync(token);
        }

        _channel = await _connection.CreateChannelAsync(new CreateChannelOptions(
            publisherConfirmationsEnabled: true,
            publisherConfirmationTrackingEnabled: true), token);
        await RabbitTopology.DeclareAsync(_channel, token);
        return _channel;
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null) await _channel.DisposeAsync();
        if (_connection is not null) await _connection.DisposeAsync();
        _gate.Dispose();
    }
}
