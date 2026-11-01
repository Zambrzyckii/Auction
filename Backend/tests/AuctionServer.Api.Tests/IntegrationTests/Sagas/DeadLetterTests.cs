using System.Text.Json;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Infrastructure.Delivery;
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
        Assert.NotNull(row.ProcessedOn);
        Assert.False(row.IsDead);

        var deliveries = scope.ServiceProvider.GetRequiredService<DeliveryDbContext>();
        var delivery = await deliveries.DeliveryMessages.AsNoTracking().SingleAsync(m => m.MessageId == eventId);
        Assert.Equal("Auctions", delivery.Recipient);
        Assert.True(delivery.IsDead);
        Assert.Null(delivery.ProcessedOn);
        Assert.Equal(6, delivery.AttemptCount);
        Assert.NotEmpty(delivery.Errors);

        var auctions = scope.ServiceProvider.GetRequiredService<AuctionDbContext>();
        Assert.False(await auctions.ProcessedMessages.AsNoTracking().AnyAsync(m => m.EventId == eventId));
    }
}
