using AuctionServer.Shared.Infrastructure.Inbox;
using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[Collection(OutboxIntegrationCollection.Name)]
public sealed class InboxOperationTests(OutboxPostgresFixture fixture) : IAsyncLifetime
{
    public Task InitializeAsync() => fixture.ResetAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task ApplyOnceAsync_WhenEventWasAlreadyApplied_ShouldNotRunChangeAgain()
    {
        var eventId = Guid.NewGuid();
        var runs = 0;

        await using (var first = fixture.CreateContext())
        {
            await first.ApplyOnceAsync(eventId, () =>
            {
                runs++;
                return Task.CompletedTask;
            }, CancellationToken.None);
        }

        await using var replay = fixture.CreateContext();
        await replay.ApplyOnceAsync(eventId, () =>
        {
            runs++;
            return Task.CompletedTask;
        }, CancellationToken.None);

        Assert.Equal(1, runs);
        Assert.Equal(1, await replay.ProcessedMessages.CountAsync(m => m.EventId == eventId));
    }

    [Fact]
    public async Task ApplyOnceAsync_WhenTwoDeliveriesRace_ShouldKeepOneApplicationAndItsReply()
    {
        var eventId = Guid.NewGuid();

        await using var loser = fixture.CreateContext();
        await loser.ApplyOnceAsync(eventId, async () =>
        {
            await using var winner = fixture.CreateContext();
            await winner.ApplyOnceAsync(eventId,
                () => Task.FromResult<OutboxMessage?>(new OutboxMessage
                {
                    Id = Guid.NewGuid(), Type = "RaceWinner", Content = "{}"
                }), CancellationToken.None);

            return new OutboxMessage { Id = Guid.NewGuid(), Type = "RaceLoser", Content = "{}" };
        }, CancellationToken.None);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == eventId));
        var reply = await context.OutboxMessages.SingleAsync();
        Assert.Equal("RaceWinner", reply.Type);
    }

    [Fact]
    public async Task ApplyOnceAsync_WhenRaceLoserFailsOnADomainIndexFirst_ShouldSwallowTheDuplicate()
    {
        var eventId = Guid.NewGuid();

        await using var loser = fixture.CreateContext();
        await loser.ApplyOnceAsync(eventId, async () =>
        {
            loser.DomainRecords.Add(new TestDomainRecord { Id = Guid.NewGuid(), Code = "Contested" });

            await using var winner = fixture.CreateContext();
            await winner.ApplyOnceAsync(eventId, () =>
            {
                winner.DomainRecords.Add(new TestDomainRecord { Id = Guid.NewGuid(), Code = "Contested" });
                return Task.CompletedTask;
            }, CancellationToken.None);
        }, CancellationToken.None);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == eventId));
        Assert.Equal(1, await context.DomainRecords.CountAsync(r => r.Code == "Contested"));
    }

    [Fact]
    public async Task ApplyOnceAsync_WhenAnotherConstraintIsViolated_ShouldPropagateTheError()
    {
        var existingId = Guid.NewGuid();
        await using (var seed = fixture.CreateContext())
        {
            seed.OutboxMessages.Add(new OutboxMessage { Id = existingId, Type = "Existing", Content = "{}" });
            await seed.SaveChangesAsync();
        }

        var eventId = Guid.NewGuid();
        await using (var context = fixture.CreateContext())
        {
            await Assert.ThrowsAsync<DbUpdateException>(() => context.ApplyOnceAsync(eventId,
                () => Task.FromResult<OutboxMessage?>(new OutboxMessage
                {
                    Id = existingId, Type = "Duplicate", Content = "{}"
                }), CancellationToken.None));
        }

        await using var check = fixture.CreateContext();
        Assert.False(await check.ProcessedMessages.AnyAsync(m => m.EventId == eventId));
    }
}
