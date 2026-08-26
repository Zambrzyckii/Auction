using System.Text.Json;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Shared.Integration.Messaging;

public static class IntegrationEventTypes
{
    private static readonly IReadOnlyDictionary<string, Type> Registry = new Dictionary<string, Type>
    {
        [nameof(UserRegisteredEvent)] = typeof(UserRegisteredEvent),
        [nameof(BidPlacedEvent)] = typeof(BidPlacedEvent),
        [nameof(AuctionFinishedEvent)] = typeof(AuctionFinishedEvent),
        [nameof(ItemSoldToShopEvent)] = typeof(ItemSoldToShopEvent),
    };

    public static INotification Deserialize(string type, string content)
    {
        if (!Registry.TryGetValue(type, out var clrType))
            throw new NotSupportedException($"Unknown integration event type: {type}");

        return (INotification?)JsonSerializer.Deserialize(content, clrType)
               ?? throw new JsonException($"Empty payload for integration event {type}");
    }
}
