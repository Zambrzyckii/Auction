using System.Text.Json;
using AuctionServer.Shared.Infrastructure.Delivery;
using AuctionServer.Shared.Integration.Events.Players;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[Collection(OutboxIntegrationCollection.Name)]
public class DeliveryProcessorTests(OutboxPostgresFixture fixture)
{
    private ServiceProvider BuildProvider(DeliveryLog log)
    {
        var services = new ServiceCollection();
        services.AddDbContext<DeliveryDbContext>(options => options.UseNpgsql(fixture.ConnectionString));
        services.AddSingleton(log);
        services.AddScoped<INotificationHandler<PlayerLevelledUpEvent>, FirstRecipientHandler>();
        services.AddScoped<INotificationHandler<PlayerLevelledUpEvent>, SecondRecipientHandler>();
        services.AddScoped<INotificationHandler<PlayerLevelledUpEvent>, FailingRecipientHandler>();
        return services.BuildServiceProvider();
    }

    private static DeliveryRecipientRegistry Registry(params DeliveryRecipient[] recipients) => new(
        new Dictionary<string, IReadOnlyList<DeliveryRecipient>>
        {
            [nameof(PlayerLevelledUpEvent)] = recipients
        });

    private async Task<Guid> SeedEventAsync(DeliveryRecipientRegistry registry)
    {
        var id = Guid.NewGuid();
        var content = JsonSerializer.Serialize(new PlayerLevelledUpEvent(id, Guid.NewGuid(), 1, 2, 10m));
        await using var context = fixture.CreateDeliveryContext();
        var dispatcher = new DeliveryDispatcher(context, registry);
        await dispatcher.AcceptAsync(id, nameof(PlayerLevelledUpEvent), content, CancellationToken.None);
        return id;
    }

    private async Task FastForwardAsync()
    {
        await using var context = fixture.CreateDeliveryContext();
        await context.Database.ExecuteSqlRawAsync(
            """UPDATE "DeliveryMessages" SET "NextAttemptOn" = now(), "LeasedUntil" = NULL WHERE "ProcessedOn" IS NULL AND NOT "IsDead" """);
    }

    [Fact]
    public async Task RunPassAsync_ShouldDeliverInRecipientOrder()
    {
        await fixture.ResetAsync();
        var registry = Registry(
            DeliveryRecipient.Of<PlayerLevelledUpEvent, FirstRecipientHandler>("First"),
            DeliveryRecipient.Of<PlayerLevelledUpEvent, SecondRecipientHandler>("Second"));
        var id = await SeedEventAsync(registry);
        var log = new DeliveryLog();
        await using var provider = BuildProvider(log);

        var processor = new DeliveryProcessor(provider, registry, NullLogger<DeliveryProcessor>.Instance);
        await processor.RunPassAsync(CancellationToken.None);

        Assert.Equal(new[] { "First", "Second" }, log.Entries);
        await using var verify = fixture.CreateDeliveryContext();
        var rows = await verify.DeliveryMessages.Where(m => m.MessageId == id).ToListAsync();
        Assert.All(rows, m => Assert.NotNull(m.ProcessedOn));
    }

    [Fact]
    public async Task RunPassAsync_WhenOneRecipientFails_ShouldStillDeliverToOthers()
    {
        await fixture.ResetAsync();
        var registry = Registry(
            DeliveryRecipient.Of<PlayerLevelledUpEvent, FailingRecipientHandler>("Failing"),
            DeliveryRecipient.Of<PlayerLevelledUpEvent, SecondRecipientHandler>("Second"));
        var id = await SeedEventAsync(registry);
        var log = new DeliveryLog();
        await using var provider = BuildProvider(log);

        var processor = new DeliveryProcessor(provider, registry, NullLogger<DeliveryProcessor>.Instance);
        await processor.RunPassAsync(CancellationToken.None);

        Assert.Equal(new[] { "Second" }, log.Entries);
        await using var verify = fixture.CreateDeliveryContext();
        var failed = await verify.DeliveryMessages.SingleAsync(m => m.MessageId == id && m.Recipient == "Failing");
        var delivered = await verify.DeliveryMessages.SingleAsync(m => m.MessageId == id && m.Recipient == "Second");
        Assert.Null(failed.ProcessedOn);
        Assert.False(failed.IsDead);
        Assert.Equal(2, failed.AttemptCount);
        Assert.NotNull(failed.NextAttemptOn);
        Assert.Contains("recipient failure", failed.Errors);
        Assert.NotNull(delivered.ProcessedOn);
    }

    [Fact]
    public async Task RunPassAsync_WhenRecipientKeepsFailing_ShouldDeadLetterOnlyThatDelivery()
    {
        await fixture.ResetAsync();
        var registry = Registry(
            DeliveryRecipient.Of<PlayerLevelledUpEvent, FailingRecipientHandler>("Failing"),
            DeliveryRecipient.Of<PlayerLevelledUpEvent, SecondRecipientHandler>("Second"));
        var id = await SeedEventAsync(registry);
        var log = new DeliveryLog();
        await using var provider = BuildProvider(log);
        var processor = new DeliveryProcessor(provider, registry, NullLogger<DeliveryProcessor>.Instance);

        foreach (var _ in Enumerable.Range(0, 5))
        {
            await processor.RunPassAsync(CancellationToken.None);
            await FastForwardAsync();
        }

        Assert.Equal(new[] { "Second" }, log.Entries);
        await using var verify = fixture.CreateDeliveryContext();
        var dead = await verify.DeliveryMessages.SingleAsync(m => m.MessageId == id && m.Recipient == "Failing");
        var delivered = await verify.DeliveryMessages.SingleAsync(m => m.MessageId == id && m.Recipient == "Second");
        Assert.True(dead.IsDead);
        Assert.Equal(6, dead.AttemptCount);
        Assert.Null(dead.ProcessedOn);
        Assert.NotNull(delivered.ProcessedOn);
    }
}
