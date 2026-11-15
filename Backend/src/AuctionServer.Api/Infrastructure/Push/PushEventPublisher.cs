using AuctionServer.Shared.Integration.Messaging;

namespace AuctionServer.Api.Infrastructure.Push;

public sealed class PushEventPublisher(
    IIntegrationEventPublisher inner,
    PushRoutes routes,
    PushConnections connections,
    ILogger<PushEventPublisher> logger) : IIntegrationEventPublisher
{
    public async Task PublishAsync(Guid messageId, string type, string content, CancellationToken token)
    {
        await inner.PublishAsync(messageId, type, content, token);

        try
        {
            routes.Dispatch(IntegrationEventTypes.Deserialize(type, content), connections);
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Push nudge for {EventType} {MessageId} was skipped", type, messageId);
        }
    }
}
