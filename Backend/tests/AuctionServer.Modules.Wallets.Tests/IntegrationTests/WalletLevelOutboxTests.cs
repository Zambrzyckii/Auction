using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Command.AddFunds;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Banking;
using AuctionServer.Shared.Integration.Events.Items;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using AuctionServer.Shared.Integration.Events.Players;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class WalletLevelOutboxTests(WalletsPostgresFixture fixture)
{
    private async Task<List<(Guid OutboxId, PlayerLevelledUpEvent Event)>> GetLevelEventsAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        var rows = await context.OutboxMessages
            .Where(m => m.Type == nameof(PlayerLevelledUpEvent))
            .ToListAsync();
        return rows
            .Select(m => (m.Id, JsonSerializer.Deserialize<PlayerLevelledUpEvent>(m.Content)!))
            .Where(pair => pair.Item2.UserId == userId)
            .ToList();
    }

    [Fact]
    public async Task AddFunds_WhenCreditCrossesLevels_ShouldWriteLevelEventInSameSave()
    {
        var userId = await fixture.SeedWalletAsync(500m);

        await using (var context = fixture.CreateContext())
        {
            var handler = new AddFundsCommandHandler(new WalletRepository(context));
            await handler.Handle(new AddFundsCommand(userId, 8500m), CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(9140m, wallet.AvailableFunds);
        Assert.Equal(3, wallet.RewardedLevel);

        var levelEvents = await GetLevelEventsAsync(userId);
        var (outboxId, levelledUp) = Assert.Single(levelEvents);
        Assert.Equal(outboxId, levelledUp.EventId);
        Assert.Equal(0, levelledUp.PreviousLevel);
        Assert.Equal(3, levelledUp.NewLevel);
        Assert.Equal(140m, levelledUp.RewardAmount);
    }

    [Fact]
    public async Task ItemSoldToShop_WhenCreditCrossesLevel_ShouldWriteLevelEvent()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = new ItemSoldToShopEvent(Guid.NewGuid(), Guid.NewGuid(), userId, 600m);

        await using (var context = fixture.CreateContext())
        {
            var handler = new ItemSoldToShopEventHandler(new WalletRepository(context));
            await handler.Handle(notification, CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(1110m, wallet.AvailableFunds);
        Assert.Equal(1, wallet.RewardedLevel);
        Assert.Single(await GetLevelEventsAsync(userId));
    }

    [Fact]
    public async Task PawnshopPayout_WhenDeliveredTwice_ShouldRewardOnceAndWriteOneEvent()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = new PawnshopPayoutEvent(Guid.NewGuid(), Guid.NewGuid(), userId, 600m);

        foreach (var _ in Enumerable.Range(0, 2))
        {
            await using var context = fixture.CreateContext();
            var handler = new PawnshopPayoutEventHandler(new WalletRepository(context));
            await handler.Handle(notification, CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(1110m, wallet.AvailableFunds);
        Assert.Equal(1, wallet.RewardedLevel);
        Assert.Single(await GetLevelEventsAsync(userId));
    }

    [Fact]
    public async Task LoanRequested_WhenPrincipalCrossesLevels_ShouldWriteReplyAndLevelEvent()
    {
        var userId = await fixture.SeedWalletAsync(0m);
        var notification = new LoanRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), userId, 5000m, 0m);

        await using (var context = fixture.CreateContext())
        {
            var handler = new LoanRequestedEventHandler(new WalletRepository(context));
            await handler.Handle(notification, CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(5050m, wallet.AvailableFunds);
        Assert.Equal(2, wallet.RewardedLevel);

        var levelEvents = await GetLevelEventsAsync(userId);
        var (_, levelledUp) = Assert.Single(levelEvents);
        Assert.Equal(2, levelledUp.NewLevel);
        Assert.Equal(50m, levelledUp.RewardAmount);

        await using var assertContext = fixture.CreateContext();
        Assert.True(await assertContext.OutboxMessages.AnyAsync(m =>
            m.Type == nameof(LoanApprovedEvent) && m.Content.Contains(userId.ToString())));
    }

    [Fact]
    public async Task AuctionFinished_ShouldLevelTheSellerOnly()
    {
        var auctionId = Guid.NewGuid();
        var winnerId = Guid.NewGuid();
        await using (var seedContext = fixture.CreateContext())
        {
            var winner = new Wallet { UserId = winnerId };
            winner.GrantStartingFunds(2000m);
            winner.LockFunds(auctionId, 2000m);
            seedContext.Wallets.Add(winner);
            await seedContext.SaveChangesAsync();
        }
        var sellerId = await fixture.SeedWalletAsync(0m);
        var notification = new AuctionFinishedEvent(Guid.NewGuid(), auctionId, sellerId, winnerId, 2000m);

        await using (var context = fixture.CreateContext())
        {
            var handler = new AuctionFinishedEventHandler(new WalletRepository(context));
            await handler.Handle(notification, CancellationToken.None);
        }

        var seller = await fixture.GetWalletAsync(sellerId);
        Assert.Equal(2010m, seller.AvailableFunds);
        Assert.Equal(1, seller.RewardedLevel);
        Assert.Single(await GetLevelEventsAsync(sellerId));

        var winnerWallet = await fixture.GetWalletAsync(winnerId);
        Assert.Equal(0, winnerWallet.RewardedLevel);
        Assert.Empty(await GetLevelEventsAsync(winnerId));
    }

    [Fact]
    public async Task AddFunds_WhenStoredLevelLagsBehindTurnover_ShouldCatchUpOnNextCredit()
    {
        var userId = await fixture.SeedWalletAsync(0m);
        await using (var sqlContext = fixture.CreateContext())
        {
            await sqlContext.Database.ExecuteSqlAsync(
                $"""UPDATE "Wallets" SET "LifetimeTurnover" = 5000 WHERE "UserId" = {userId}""");
        }

        await using (var context = fixture.CreateContext())
        {
            var handler = new AddFundsCommandHandler(new WalletRepository(context));
            await handler.Handle(new AddFundsCommand(userId, 1m), CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(2, wallet.RewardedLevel);
        Assert.Equal(51m, wallet.AvailableFunds);

        var levelEvents = await GetLevelEventsAsync(userId);
        var (_, levelledUp) = Assert.Single(levelEvents);
        Assert.Equal(0, levelledUp.PreviousLevel);
        Assert.Equal(2, levelledUp.NewLevel);
        Assert.Equal(50m, levelledUp.RewardAmount);
    }
}
