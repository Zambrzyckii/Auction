using System.Text.Json;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Items;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Api.Tests.IntegrationTests.Sagas;

[Collection(SagaStageCollection.Name)]
public class DeadLetterTests(SagaStageFixture stage)
{
    [Fact]
    public async Task UndeliverableMessage_ShouldRetryAndDeadLetter()
    {
        var eventId = Guid.NewGuid();
        var poison = new ItemLockedEvent(eventId, Guid.NewGuid(), Guid.NewGuid(), "Phantom Crate", "Common", 10m);

        using (var seedScope = stage.Factory.Services.CreateScope())
        {
            var inventory = seedScope.ServiceProvider.GetRequiredService<InventoryDbContext>();
            inventory.OutboxMessages.Add(new OutboxMessage
            {
                Id = eventId,
                Type = nameof(ItemLockedEvent),
                Content = JsonSerializer.Serialize(poison)
            });
            await inventory.SaveChangesAsync();
        }

        await stage.WaitForOutboxQuietAsync(fastForwardRetries: true, timeout: TimeSpan.FromSeconds(90));

        using var scope = stage.Factory.Services.CreateScope();
        var outbox = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
        var row = await outbox.OutboxMessages.AsNoTracking().SingleAsync(m => m.Id == eventId);
        Assert.True(row.IsDead);
        Assert.Null(row.ProcessedOn);
        Assert.Equal(6, row.AttemptCount);
        Assert.NotEmpty(row.Errors);

        var auctions = scope.ServiceProvider.GetRequiredService<AuctionDbContext>();
        Assert.False(await auctions.ProcessedMessages.AsNoTracking().AnyAsync(m => m.EventId == eventId));
    }
}
