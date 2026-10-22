using System.Text.Json;
using AuctionServer.Shared.Integration.Events.Users;
using AuctionServer.Shared.Integration.Messaging;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class UserRegisteredEventCompatibilityTests
{
    [Fact]
    public void Deserialize_WhenPayloadPredatesUsername_ShouldLeaveUsernameNull()
    {
        var eventId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var legacyContent = $"{{\"EventId\":\"{eventId}\",\"PublicUserId\":\"{userId}\",\"Email\":\"old@player.test\"}}";

        var deserialized = Assert.IsType<UserRegisteredEvent>(
            IntegrationEventTypes.Deserialize(nameof(UserRegisteredEvent), legacyContent));

        Assert.Equal(eventId, deserialized.EventId);
        Assert.Equal(userId, deserialized.PublicUserId);
        Assert.Equal("old@player.test", deserialized.Email);
        Assert.Null(deserialized.Username);
    }

    [Fact]
    public void Deserialize_ShouldRoundTripUsername()
    {
        var registeredEvent = new UserRegisteredEvent(Guid.NewGuid(), Guid.NewGuid(), "new@player.test", "new-player");
        var content = JsonSerializer.Serialize(registeredEvent);

        var deserialized = IntegrationEventTypes.Deserialize(nameof(UserRegisteredEvent), content);

        Assert.Equal(registeredEvent, deserialized);
    }
}
