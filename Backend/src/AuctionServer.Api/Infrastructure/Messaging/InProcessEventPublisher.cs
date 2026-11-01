using AuctionServer.Shared.Infrastructure.Delivery;
using AuctionServer.Shared.Integration.Messaging;

namespace AuctionServer.Api.Infrastructure.Messaging;

public sealed class InProcessEventPublisher(IIntegrationEventDispatcher dispatcher) : IIntegrationEventPublisher
{
    public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token) =>
        dispatcher.AcceptAsync(messageId, type, content, token);
}
