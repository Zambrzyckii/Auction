using System.Text.Json;
using AuctionServer.Shared.Infrastructure.Delivery;
using AuctionServer.Shared.Integration.Events.Players;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[Collection(OutboxIntegrationCollection.Name)]
public class DeliveryDispatcherTests(OutboxPostgresFixture fixture)
{
    private static (Guid Id, string Type, string Content) NewEvent()
    {
        var id = Guid.NewGuid();
        var content = JsonSerializer.Serialize(new PlayerLevelledUpEvent(id, Guid.NewGuid(), 1, 2, 10m));
        return (id, nameof(PlayerLevelledUpEvent), content);
    }

    private static DeliveryRecipientRegistry TwoRecipients() => new(
        new Dictionary<string, IReadOnlyList<DeliveryRecipient>>
        {
            [nameof(PlayerLevelledUpEvent)] =
            [
                DeliveryRecipient.Of<PlayerLevelledUpEvent, FirstRecipientHandler>("First"),
                DeliveryRecipient.Of<PlayerLevelledUpEvent, SecondRecipientHandler>("Second")
            ]
        });

    [Fact]
    public async Task AcceptAsync_ShouldInsertOneRowPerRecipientInRegistryOrder()
    {
        await fixture.ResetAsync();
        var (id, type, content) = NewEvent();
        await using (var context = fixture.CreateDeliveryContext())
        {
            var dispatcher = new DeliveryDispatcher(context, TwoRecipients());
            await dispatcher.AcceptAsync(id, type, content, CancellationToken.None);
        }

        await using var verify = fixture.CreateDeliveryContext();
        var rows = await verify.DeliveryMessages
            .Where(m => m.MessageId == id)
            .OrderBy(m => m.Position)
            .ToListAsync();
        Assert.Equal(new[] { "First", "Second" }, rows.Select(m => m.Recipient));
        Assert.Equal(new[] { 0, 1 }, rows.Select(m => m.Position));
        Assert.All(rows, m => Assert.Null(m.ProcessedOn));
    }

    [Fact]
    public async Task AcceptAsync_WhenCalledTwice_ShouldNotDuplicateDeliveries()
    {
        await fixture.ResetAsync();
        var (id, type, content) = NewEvent();
        foreach (var _ in Enumerable.Range(0, 2))
        {
            await using var context = fixture.CreateDeliveryContext();
            var dispatcher = new DeliveryDispatcher(context, TwoRecipients());
            await dispatcher.AcceptAsync(id, type, content, CancellationToken.None);
        }

        await using var verify = fixture.CreateDeliveryContext();
        Assert.Equal(2, await verify.DeliveryMessages.CountAsync(m => m.MessageId == id));
    }

    [Fact]
    public async Task AcceptAsync_WhenEventHasNoRecipients_ShouldInsertNothing()
    {
        await fixture.ResetAsync();
        var (id, type, content) = NewEvent();
        var registry = new DeliveryRecipientRegistry(
            new Dictionary<string, IReadOnlyList<DeliveryRecipient>> { [type] = [] });
        await using (var context = fixture.CreateDeliveryContext())
        {
            var dispatcher = new DeliveryDispatcher(context, registry);
            await dispatcher.AcceptAsync(id, type, content, CancellationToken.None);
        }

        await using var verify = fixture.CreateDeliveryContext();
        Assert.Equal(0, await verify.DeliveryMessages.CountAsync());
    }
}
