using AuctionServer.Modules.Casino.Application.Options;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Casino.Tests.Application;

public class CasinoModuleExtensionsTests
{
    private static CasinoOptions ValidOptions() =>
        new(TimeSpan.FromMinutes(15),
            new RouletteOptions(1m, 1000m, 20),
            new BlackjackOptions(5m, 2000m, TimeSpan.FromMinutes(5)));

    private static void AddModule(CasinoOptions options) =>
        new ServiceCollection().AddCasinoModule("Host=localhost", options);

    [Fact]
    public void AddCasinoModule_WithValidOptions_ShouldNotThrow() => AddModule(ValidOptions());

    [Fact]
    public void AddCasinoModule_WhenRouletteSectionMissing_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { Roulette = null! }));

    [Fact]
    public void AddCasinoModule_WhenBlackjackSectionMissing_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { Blackjack = null! }));

    [Fact]
    public void AddCasinoModule_WhenPurchaseTimeoutBelowDeadLetterHorizon_ShouldThrow() =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with { PurchaseTimeout = TimeSpan.FromMinutes(9) }));

    [Theory]
    [InlineData(0, 1000)]
    [InlineData(10, 5)]
    [InlineData(1.5, 1000)]
    [InlineData(1, 999.5)]
    public void AddCasinoModule_WhenRouletteBetLimitsInvalid_ShouldThrow(decimal minBet, decimal maxBet) =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with
        {
            Roulette = new RouletteOptions(minBet, maxBet, 20)
        }));

    [Theory]
    [InlineData(0, 2000)]
    [InlineData(10, 5)]
    [InlineData(5.5, 2000)]
    [InlineData(5, 1999.5)]
    public void AddCasinoModule_WhenBlackjackBetLimitsInvalid_ShouldThrow(decimal minBet, decimal maxBet) =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with
        {
            Blackjack = new BlackjackOptions(minBet, maxBet, TimeSpan.FromMinutes(5))
        }));

    [Theory]
    [InlineData(0)]
    [InlineData(51)]
    public void AddCasinoModule_WhenMaxBetsPerSpinOutOfRange_ShouldThrow(int maxBetsPerSpin) =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with
        {
            Roulette = new RouletteOptions(1m, 1000m, maxBetsPerSpin)
        }));

    [Theory]
    [InlineData(29)]
    [InlineData(86401)]
    public void AddCasinoModule_WhenHandTimeoutOutOfRange_ShouldThrow(int seconds) =>
        Assert.Throws<ArgumentException>(() => AddModule(ValidOptions() with
        {
            Blackjack = new BlackjackOptions(5m, 2000m, TimeSpan.FromSeconds(seconds))
        }));
}
