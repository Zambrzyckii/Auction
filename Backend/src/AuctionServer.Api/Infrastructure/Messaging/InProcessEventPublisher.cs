using AuctionServer.Shared.Integration.Messaging;
using MediatR;

namespace AuctionServer.Api.Infrastructure.Messaging;

public sealed class InProcessEventPublisher(IPublisher publisher) : IIntegrationEventPublisher
{
    public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token) =>
        publisher.Publish(IntegrationEventTypes.Deserialize(type, content), token);
}
