using System.Text.Json;
using AuctionServer.Shared.Integration.Events.Casino;
using AuctionServer.Shared.Integration.Messaging;
using MediatR;

namespace AuctionServer.Modules.Casino.Tests.Application;

public class IntegrationEventRegistryTests
{
    public static TheoryData<INotification> CasinoEvents => new()
    {
        new CasinoChipPurchaseRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 500m),
        new CasinoChipPurchaseCompletedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
        new CasinoChipPurchaseRejectedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Not enough funds on account"),
        new CasinoCashOutEvent(Guid.NewGuid(), Guid.NewGuid(), 487.5m)
    };

    [Theory]
    [MemberData(nameof(CasinoEvents))]
    public void Deserialize_ShouldRoundTripEveryCasinoEvent(INotification notification)
    {
        var type = notification.GetType();
        var content = JsonSerializer.Serialize(notification, type);

        var deserialized = IntegrationEventTypes.Deserialize(type.Name, content);

        Assert.Equal(notification, deserialized);
    }
}
