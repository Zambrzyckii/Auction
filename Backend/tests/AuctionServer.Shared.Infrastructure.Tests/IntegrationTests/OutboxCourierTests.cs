using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[Collection(OutboxIntegrationCollection.Name)]
public class OutboxCourierTests(OutboxPostgresFixture fixture)
{
    private static OutboxMessage NewMessage() =>
        new() { Id = Guid.NewGuid(), Type = "TestEvent", Content = "{}" };

    [Fact]
    public async Task ClaimAsync_WhenTwoCouriersClaimConcurrently_ShouldNotShareMessages()
    {
        await fixture.ResetAsync();
        var seeded = Enumerable.Range(0, 30).Select(_ => NewMessage()).ToList();
        await using (var seedContext = fixture.CreateContext())
        {
            seedContext.OutboxMessages.AddRange(seeded);
            await seedContext.SaveChangesAsync();
        }

        await using var firstCourier = fixture.CreateContext();
        await using var secondCourier = fixture.CreateContext();
        var claims = await Task.WhenAll(
            OutboxCourier.ClaimAsync(firstCourier, 20, CancellationToken.None),
            OutboxCourier.ClaimAsync(secondCourier, 20, CancellationToken.None));

        var firstIds = claims[0].Select(m => m.Id).ToHashSet();
        var secondIds = claims[1].Select(m => m.Id).ToHashSet();
        Assert.Empty(firstIds.Intersect(secondIds));
        Assert.Equal(30, firstIds.Count + secondIds.Count);
    }

    [Fact]
    public async Task ClaimAsync_ShouldSkipRetryingDeadAndProcessedMessages()
    {
        await fixture.ResetAsync();
        var claimable = NewMessage();
        var retrying = NewMessage();
        retrying.FailedAttempt("boom");
        var dead = NewMessage();
        dead.MarkMessageAsDead();
        var processed = NewMessage();
        processed.MarkAsProcessed();
        await using (var seedContext = fixture.CreateContext())
        {
            seedContext.OutboxMessages.AddRange(claimable, retrying, dead, processed);
            await seedContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var claimed = await OutboxCourier.ClaimAsync(context, 10, CancellationToken.None);

        var message = Assert.Single(claimed);
        Assert.Equal(claimable.Id, message.Id);
        Assert.NotNull(message.LeasedUntil);
    }

    [Fact]
    public async Task ClaimAsync_WhenMessageIsLeased_ShouldNotClaimItAgain()
    {
        await fixture.ResetAsync();
        await using (var seedContext = fixture.CreateContext())
        {
            seedContext.OutboxMessages.Add(NewMessage());
            await seedContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var firstClaim = await OutboxCourier.ClaimAsync(context, 10, CancellationToken.None);
        var secondClaim = await OutboxCourier.ClaimAsync(context, 10, CancellationToken.None);

        Assert.Single(firstClaim);
        Assert.Empty(secondClaim);
    }

    [Fact]
    public async Task CleanupAsync_ShouldRemoveOnlyProcessedMessagesPastRetention()
    {
        await fixture.ResetAsync();
        var processedOld = NewMessage();
        processedOld.MarkAsProcessed();
        var processedFresh = NewMessage();
        processedFresh.MarkAsProcessed();
        var pendingOld = new OutboxMessage
        {
            Id = Guid.NewGuid(), Type = "TestEvent", Content = "{}",
            CreatedOn = DateTime.UtcNow.AddDays(-8)
        };
        var deadOld = new OutboxMessage
        {
            Id = Guid.NewGuid(), Type = "TestEvent", Content = "{}",
            CreatedOn = DateTime.UtcNow.AddDays(-8)
        };
        deadOld.MarkMessageAsDead();
        await using (var seedContext = fixture.CreateContext())
        {
            seedContext.OutboxMessages.AddRange(processedOld, processedFresh, pendingOld, deadOld);
            seedContext.Entry(processedOld).Property(m => m.ProcessedOn).CurrentValue =
                DateTime.UtcNow.AddDays(-8);
            await seedContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var removed = await OutboxCourier.CleanupAsync(context, TimeSpan.FromDays(7), CancellationToken.None);

        Assert.Equal(1, removed);
        var remainingIds = context.OutboxMessages.Select(m => m.Id).ToHashSet();
        Assert.DoesNotContain(processedOld.Id, remainingIds);
        Assert.Contains(processedFresh.Id, remainingIds);
        Assert.Contains(pendingOld.Id, remainingIds);
        Assert.Contains(deadOld.Id, remainingIds);
    }
}
