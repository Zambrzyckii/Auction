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
}
