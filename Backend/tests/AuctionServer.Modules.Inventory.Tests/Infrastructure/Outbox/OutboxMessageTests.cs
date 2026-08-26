using AuctionServer.Modules.Inventory.Infrastructure.Outbox;

namespace AuctionServer.Modules.Inventory.Tests.Infrastructure.Outbox;

public class OutboxMessageTests
{
    private static OutboxMessage CreateMessage() =>
        new() { Id = Guid.NewGuid(), Type = "TestEvent", Content = "{}" };

    [Fact]
    public void FailedAttempt_ShouldIncrementAttemptCountAndStoreError()
    {
        var message = CreateMessage();
        var attemptsBefore = message.AttemptCount;

        message.FailedAttempt("something broke");

        Assert.Equal(attemptsBefore + 1, message.AttemptCount);
        Assert.Contains("something broke", message.Errors);
    }

    [Fact]
    public void FailedAttempt_WhenCalledRepeatedly_ShouldGrowBackoffDelay()
    {
        var message = CreateMessage();

        message.FailedAttempt("first");
        var firstDelay = message.NextAttemptOn!.Value - DateTime.UtcNow;
        message.FailedAttempt("second");
        var secondDelay = message.NextAttemptOn!.Value - DateTime.UtcNow;

        Assert.True(secondDelay > firstDelay);
        Assert.Equal(2, message.Errors.Count);
    }

    [Fact]
    public void MarkMessageAsDead_ShouldSetIsDead()
    {
        var message = CreateMessage();

        message.MarkMessageAsDead();

        Assert.True(message.IsDead);
    }

    [Fact]
    public void MarkAsProcessed_ShouldSetProcessedOn()
    {
        var message = CreateMessage();

        message.MarkAsProcessed();

        Assert.NotNull(message.ProcessedOn);
    }
}
