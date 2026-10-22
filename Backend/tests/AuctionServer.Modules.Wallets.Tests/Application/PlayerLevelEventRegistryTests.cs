using System.Text.Json;
using AuctionServer.Shared.Integration.Events.Players;
using AuctionServer.Shared.Integration.Messaging;

namespace AuctionServer.Modules.Wallets.Tests.Application;

public class PlayerLevelEventRegistryTests
{
    [Fact]
    public void Deserialize_ShouldRoundTripPlayerLevelledUpEvent()
    {
        var levelledUp = new PlayerLevelledUpEvent(Guid.NewGuid(), Guid.NewGuid(), 2, 4, 250m);
        var content = JsonSerializer.Serialize(levelledUp);

        var deserialized = IntegrationEventTypes.Deserialize(nameof(PlayerLevelledUpEvent), content);

        Assert.Equal(levelledUp, deserialized);
    }
}
