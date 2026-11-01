namespace AuctionServer.Shared.Infrastructure.Delivery;

public sealed class DeliveryRecipientRegistry(
    IReadOnlyDictionary<string, IReadOnlyList<DeliveryRecipient>> recipients)
{
    public IReadOnlyList<DeliveryRecipient> For(string eventType) =>
        recipients.TryGetValue(eventType, out var list)
            ? list
            : throw new NotSupportedException($"No recipients registered for integration event type: {eventType}");
}
