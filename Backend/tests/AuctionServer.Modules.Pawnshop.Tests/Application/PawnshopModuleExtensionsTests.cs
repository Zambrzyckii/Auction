using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Pawnshop.Tests.Application;

public class PawnshopModuleExtensionsTests
{
    private static BotTierDefinition Tier(string name = "Pawn Clerk", PawnshopRarity rarity = PawnshopRarity.Common,
        decimal price = 50000m, TimeSpan? spawnInterval = null, decimal payoutRate = 0.5m) =>
        new(name, rarity, price, spawnInterval ?? TimeSpan.FromSeconds(30), payoutRate);

    private static PawnshopOptions ValidOptions(params BotTierDefinition[] tiers) =>
        new(100000m, 1000000m, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(15),
            tiers.Length == 0 ? [Tier()] : tiers);

    private static void AddModule(PawnshopOptions options) =>
        new ServiceCollection().AddPawnshopModule("Host=localhost", options);

    [Fact]
    public void AddPawnshopModule_WithValidOptions_ShouldNotThrow() => AddModule(ValidOptions());

    [Fact]
    public void AddPawnshopModule_WhenPremisesPriceNotPositive_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { PremisesPrice = 0m }));

    [Fact]
    public void AddPawnshopModule_WhenRequiredTurnoverNegative_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { PremisesRequiredTurnover = -1m }));

    [Fact]
    public void AddPawnshopModule_WhenSellDelayTooShort_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { StockSellDelay = TimeSpan.FromSeconds(29) }));

    [Fact]
    public void AddPawnshopModule_WhenSellDelayTooLong_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { StockSellDelay = TimeSpan.FromDays(8) }));

    [Fact]
    public void AddPawnshopModule_WhenPaymentTimeoutBelowDeadLetterHorizon_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { PaymentTimeout = TimeSpan.FromMinutes(9) }));

    [Fact]
    public void AddPawnshopModule_WhenStockRequestTimeoutBelowDeadLetterHorizon_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { StockRequestTimeout = TimeSpan.FromMinutes(9) }));

    [Fact]
    public void AddPawnshopModule_WhenNoTiers_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { BotTiers = [] }));

    [Fact]
    public void AddPawnshopModule_WhenTierNamesDuplicated_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(
            Tier("Pawn Clerk"), Tier("PAWN CLERK", PawnshopRarity.Rare))));

    [Fact]
    public void AddPawnshopModule_WhenTierRaritiesDuplicated_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(
            Tier("Pawn Clerk"), Tier("Second Clerk", PawnshopRarity.Common))));

    [Fact]
    public void AddPawnshopModule_WhenTierNameBlank_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(Tier(" "))));

    [Fact]
    public void AddPawnshopModule_WhenTierPriceNotPositive_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(Tier(price: 0m))));

    [Fact]
    public void AddPawnshopModule_WhenSpawnIntervalTooShort_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(Tier(spawnInterval: TimeSpan.FromSeconds(9)))));

    [Fact]
    public void AddPawnshopModule_WhenPayoutRateTooLow_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(Tier(payoutRate: 0.005m))));

    [Fact]
    public void AddPawnshopModule_WhenPayoutRateReachesOne_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions(Tier(payoutRate: 1m))));

    [Fact]
    public void AddPawnshopModule_WhenSellDelayOutgrowsSpawnInterval_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(
            ValidOptions(Tier(spawnInterval: TimeSpan.FromSeconds(10))) with { StockSellDelay = TimeSpan.FromHours(1) }));
}
