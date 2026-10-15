using System.Text.Json;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using AuctionServer.Shared.Integration.Messaging;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Tests.Application;

public class IntegrationEventRegistryTests
{
    public static TheoryData<INotification> PawnshopEvents => new()
    {
        new PawnshopPaymentRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 100000m, 1000000m),
        new PawnshopPaymentCompletedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
        new PawnshopPaymentRejectedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Turnover too low")
    };

    [Theory]
    [MemberData(nameof(PawnshopEvents))]
    public void Deserialize_ShouldRoundTripEveryPawnshopEvent(INotification notification)
    {
        var type = notification.GetType();
        var content = JsonSerializer.Serialize(notification, type);

        var deserialized = IntegrationEventTypes.Deserialize(type.Name, content);

        Assert.Equal(notification, deserialized);
    }

    public static TheoryData<INotification> PawnshopStockEvents => new()
    {
        new PawnshopStockRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), ["Common"]),
        new PawnshopStockedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            [new PawnshopStockItem("Pawned Common Good", "Common", 55m)])
    };

    // Records holding lists compare by reference, so these events round-trip through JSON instead.
    [Theory]
    [MemberData(nameof(PawnshopStockEvents))]
    public void Deserialize_ShouldRoundTripStockEventsByJson(INotification notification)
    {
        var type = notification.GetType();
        var content = JsonSerializer.Serialize(notification, type);

        var deserialized = IntegrationEventTypes.Deserialize(type.Name, content);

        Assert.Equal(content, JsonSerializer.Serialize(deserialized, type));
    }
}
