using System.Text.Json;
using AuctionServer.Shared.Integration.Events.Banking;
using AuctionServer.Shared.Integration.Messaging;
using MediatR;

namespace AuctionServer.Modules.Banking.Tests.Application;

public class IntegrationEventRegistryTests
{
    public static TheoryData<INotification> BankingEvents => new()
    {
        new LoanRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 200m, 400m),
        new LoanApprovedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
        new LoanRejectedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Turnover too low"),
        new LoanRepaymentRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 220m),
        new LoanRepaymentCollectedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 180m)
    };

    [Theory]
    [MemberData(nameof(BankingEvents))]
    public void Deserialize_ShouldRoundTripEveryBankingEvent(INotification notification)
    {
        var type = notification.GetType();
        var content = JsonSerializer.Serialize(notification, type);

        var deserialized = IntegrationEventTypes.Deserialize(type.Name, content);

        Assert.Equal(notification, deserialized);
    }
}
