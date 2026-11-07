using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[Collection(OutboxIntegrationCollection.Name)]
public class OutboxProcessorTests(OutboxPostgresFixture fixture)
{
    private sealed class ThrowingPublisher(Exception exception) : IIntegrationEventPublisher
    {
        public int Calls { get; private set; }

        public Task PublishAsync(Guid messageId, string type, string content, CancellationToken token)
        {
            Calls++;
            throw exception;
        }
    }

    private ServiceProvider BuildProvider(IIntegrationEventPublisher publisher)
    {
        var services = new ServiceCollection();
        services.AddDbContext<OutboxTestDbContext>(options => options.UseNpgsql(fixture.ConnectionString));
        services.AddSingleton(publisher);
        return services.BuildServiceProvider();
    }

    private async Task<(Guid First, Guid Second)> SeedTwoPendingAsync()
    {
        await using var context = fixture.CreateContext();
        var first = new OutboxMessage { Id = Guid.NewGuid(), Type = "TestEvent", Content = "{}" };
        var second = new OutboxMessage { Id = Guid.NewGuid(), Type = "TestEvent", Content = "{}" };
        context.OutboxMessages.AddRange(first, second);
        await context.SaveChangesAsync();
        return (first.Id, second.Id);
    }

    private async Task<List<OutboxMessage>> LoadAllAsync()
    {
        await using var context = fixture.CreateContext();
        return await context.OutboxMessages.AsNoTracking().ToListAsync();
    }

    [Fact]
    public async Task RunPassAsync_WhenTransportIsUnavailable_ShouldKeepRowsPendingWithoutCountingAttempts()
    {
        await fixture.ResetAsync();
        await SeedTwoPendingAsync();
        var publisher = new ThrowingPublisher(
            new TransportUnavailableException("broker down", new InvalidOperationException()));
        await using var provider = BuildProvider(publisher);
        var processor = new OutboxProcessor<OutboxTestDbContext>(
            provider, "Test", NullLogger<OutboxProcessor<OutboxTestDbContext>>.Instance);

        await processor.RunPassAsync(CancellationToken.None);

        Assert.Equal(1, publisher.Calls);
        var rows = await LoadAllAsync();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, row =>
        {
            Assert.Null(row.ProcessedOn);
            Assert.False(row.IsDead);
            Assert.Equal(1, row.AttemptCount);
            Assert.Empty(row.Errors);
            Assert.Null(row.LeasedUntil);
        });
    }

    [Fact]
    public async Task RunPassAsync_WhenPublishItselfFails_ShouldStillCountTheAttempt()
    {
        await fixture.ResetAsync();
        await SeedTwoPendingAsync();
        var publisher = new ThrowingPublisher(new InvalidOperationException("poison"));
        await using var provider = BuildProvider(publisher);
        var processor = new OutboxProcessor<OutboxTestDbContext>(
            provider, "Test", NullLogger<OutboxProcessor<OutboxTestDbContext>>.Instance);

        await processor.RunPassAsync(CancellationToken.None);

        Assert.Equal(2, publisher.Calls);
        var rows = await LoadAllAsync();
        Assert.All(rows, row =>
        {
            Assert.Null(row.ProcessedOn);
            Assert.Equal(2, row.AttemptCount);
            Assert.Contains("poison", row.Errors);
            Assert.NotNull(row.NextAttemptOn);
        });
    }
}
