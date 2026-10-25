using System.Text.Json;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Infrastructure.Background;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Funds;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class AuctionCloserTests(AuctionsPostgresFixture fixture)
{
    private async Task<Guid> RequestBidAsync(Guid publicAuctionId, Guid bidderId, decimal amount, TimeSpan? age = null)
    {
        var requestId = Guid.NewGuid();
        await using var context = fixture.CreateContext();
        var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == publicAuctionId);
        auction.RequestBid(bidderId, amount, requestId);
        if (age is not null)
            context.Entry(auction).Property(a => a.PendingBidRequestedOn).CurrentValue = DateTime.UtcNow - age;
        await context.SaveChangesAsync();
        return requestId;
    }

    private async Task RunCloserAsync(Func<Task<bool>>? until = null)
    {
        var services = new ServiceCollection();
        services.AddDbContext<AuctionDbContext>(o => o.UseNpgsql(fixture.ConnectionString));
        await using var provider = services.BuildServiceProvider();
        var closer = new AuctionCloser(provider, NullLogger<AuctionCloser>.Instance);
        await closer.StartAsync(CancellationToken.None);
        try
        {
            if (until is null)
            {
                await Task.Delay(1500);
                return;
            }

            var deadline = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < deadline && !await until()) await Task.Delay(100);
        }
        finally
        {
            await closer.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task ExecuteAsync_WhenPendingBidIsStale_ShouldClearItAndRequestUnlock()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m, age: TimeSpan.FromMinutes(15));

        await RunCloserAsync(until: async () =>
            (await fixture.GetAuctionAsync(seeded.PublicAuctionId)).PendingBidderId is null);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);
        Assert.Null(auction.PendingBidRequestId);
        Assert.Null(auction.PendingBidRequestedOn);
        Assert.Equal(AuctionStatus.Active, auction.Status);
        Assert.Null(auction.CurrentWinningUserId);

        await using var context = fixture.CreateContext();
        var unlockRow = await context.OutboxMessages.SingleAsync(m =>
            m.Type == nameof(FundsUnlockRequestedEvent) && m.Content.Contains(seeded.PublicAuctionId.ToString()));
        var unlock = JsonSerializer.Deserialize<FundsUnlockRequestedEvent>(unlockRow.Content);
        Assert.NotNull(unlock);
        Assert.Equal(bidderId, unlock.BidderUserId);
        Assert.Equal(unlockRow.Id, unlock.EventId);
    }

    [Fact]
    public async Task ExecuteAsync_WhenPendingBidIsFresh_ShouldLeaveItUntouched()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);

        await RunCloserAsync();

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(bidderId, auction.PendingBidderId);
        Assert.Equal(100m, auction.PendingBidAmount);
        Assert.Equal(requestId, auction.PendingBidRequestId);

        await using var context = fixture.CreateContext();
        Assert.False(await context.OutboxMessages.AnyAsync(m =>
            m.Type == nameof(FundsUnlockRequestedEvent) && m.Content.Contains(seeded.PublicAuctionId.ToString())));
    }
}
