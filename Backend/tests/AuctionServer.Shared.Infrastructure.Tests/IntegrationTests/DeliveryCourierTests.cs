using AuctionServer.Shared.Infrastructure.Delivery;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[Collection(OutboxIntegrationCollection.Name)]
public class DeliveryCourierTests(OutboxPostgresFixture fixture)
{
    private static DeliveryMessage NewDelivery(Guid messageId, string recipient, int position) => new()
    {
        MessageId = messageId,
        Recipient = recipient,
        Position = position,
        Type = "TestEvent",
        Content = "{}"
    };

    [Fact]
    public async Task ClaimAsync_WhenDeliveryIsLeased_ShouldNotClaimItAgain()
    {
        await fixture.ResetAsync();
        var messageId = Guid.NewGuid();
        await using (var seedContext = fixture.CreateDeliveryContext())
        {
            seedContext.DeliveryMessages.AddRange(
                NewDelivery(messageId, "First", 0),
                NewDelivery(messageId, "Second", 1));
            await seedContext.SaveChangesAsync();
        }

        await using var firstCourier = fixture.CreateDeliveryContext();
        var firstClaim = await DeliveryCourier.ClaimAsync(firstCourier, 20, CancellationToken.None);
        await using var secondCourier = fixture.CreateDeliveryContext();
        var secondClaim = await DeliveryCourier.ClaimAsync(secondCourier, 20, CancellationToken.None);

        Assert.Equal(new[] { "First", "Second" }, firstClaim.Select(m => m.Recipient));
        Assert.All(firstClaim, m => Assert.NotNull(m.LeasedUntil));
        Assert.Empty(secondClaim);
    }

    [Fact]
    public async Task CleanupAsync_ShouldRemoveOnlyProcessedDeliveriesPastRetention()
    {
        await fixture.ResetAsync();
        var processedOld = NewDelivery(Guid.NewGuid(), "First", 0);
        processedOld.MarkAsProcessed();
        var processedFresh = NewDelivery(Guid.NewGuid(), "First", 0);
        processedFresh.MarkAsProcessed();
        var pendingOld = NewDelivery(Guid.NewGuid(), "First", 0);
        var deadOld = NewDelivery(Guid.NewGuid(), "First", 0);
        deadOld.MarkMessageAsDead();
        await using (var seedContext = fixture.CreateDeliveryContext())
        {
            seedContext.DeliveryMessages.AddRange(processedOld, processedFresh, pendingOld, deadOld);
            seedContext.Entry(processedOld).Property(m => m.ProcessedOn).CurrentValue = DateTime.UtcNow.AddDays(-8);
            await seedContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateDeliveryContext();
        var removed = await DeliveryCourier.CleanupAsync(context, TimeSpan.FromDays(7), CancellationToken.None);

        Assert.Equal(1, removed);
        var remaining = await context.DeliveryMessages.Select(m => m.MessageId).ToListAsync();
        Assert.Equal(3, remaining.Count);
        Assert.DoesNotContain(processedOld.MessageId, remaining);
    }
}
