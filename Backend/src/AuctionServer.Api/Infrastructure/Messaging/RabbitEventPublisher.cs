using AuctionServer.Shared.Integration.Messaging;
using RabbitMQ.Client;

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
        }
        finally
        {
            _gate.Release();
        }
    }

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
