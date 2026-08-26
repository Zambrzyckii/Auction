namespace AuctionServer.Shared.Integration.Messaging;

public interface IIntegrationEventPublisher
{
    Task PublishAsync(Guid messageId, string type, string content, CancellationToken token);
}
