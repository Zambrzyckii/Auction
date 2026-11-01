namespace AuctionServer.Shared.Infrastructure.Delivery;

public interface IIntegrationEventDispatcher
{
    Task AcceptAsync(Guid messageId, string type, string content, CancellationToken token);
}
