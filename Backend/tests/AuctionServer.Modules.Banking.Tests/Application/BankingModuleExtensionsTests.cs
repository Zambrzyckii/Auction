using AuctionServer.Modules.Banking.Application.Options;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Banking.Tests.Application;

public class BankingModuleExtensionsTests
{
    private static BankingOptions CreateValidOptions(
        decimal penaltyRate = 0.20m,
        TimeSpan? retryInterval = null,
        TimeSpan? pendingTimeout = null,
        TimeSpan? approvalTimeout = null,
        IReadOnlyList<LoanOfferDefinition>? offers = null) =>
        new(penaltyRate,
            retryInterval ?? TimeSpan.FromMinutes(2),
            pendingTimeout ?? TimeSpan.FromMinutes(15),
            approvalTimeout ?? TimeSpan.FromMinutes(15),
            offers ?? [new LoanOfferDefinition("Quick", 200m, 0.10m, TimeSpan.FromMinutes(1), 400m)]);

    private static void Register(BankingOptions options) =>
        new ServiceCollection().AddBankingModule("Host=localhost", options);

    [Fact]
    public void AddBankingModule_WithValidOptions_ShouldNotThrow()
    {
        Register(CreateValidOptions());
    }

    [Fact]
    public void AddBankingModule_WithoutOffers_ShouldThrow()
    {
        Assert.Throws<ArgumentException>(() => Register(CreateValidOptions(offers: [])));
    }

    [Fact]
    public void AddBankingModule_WithDuplicateOfferNames_ShouldThrow()
    {
        var offer = new LoanOfferDefinition("Quick", 200m, 0.10m, TimeSpan.FromMinutes(1), 400m);
        var duplicate = offer with { Principal = 300m };

        Assert.Throws<ArgumentException>(() => Register(CreateValidOptions(offers: [offer, duplicate])));
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.5)]
    public void AddBankingModule_WithPenaltyRateOutsideUnitRange_ShouldThrow(decimal penaltyRate)
    {
        Assert.Throws<ArgumentException>(() => Register(CreateValidOptions(penaltyRate: penaltyRate)));
    }

    [Fact]
    public void AddBankingModule_WithNonPositiveRetryInterval_ShouldThrow()
    {
        Assert.Throws<ArgumentException>(() => Register(CreateValidOptions(retryInterval: TimeSpan.Zero)));
    }

    [Theory]
    [InlineData(9, 15)]
    [InlineData(15, 9)]
    public void AddBankingModule_WithTimeoutBelowDeadLetterHorizon_ShouldThrow(int pendingMinutes, int approvalMinutes)
    {
        Assert.Throws<ArgumentException>(() => Register(CreateValidOptions(
            pendingTimeout: TimeSpan.FromMinutes(pendingMinutes),
            approvalTimeout: TimeSpan.FromMinutes(approvalMinutes))));
    }

    [Theory]
    [InlineData("", 200, 0.10, 60, 400)]
    [InlineData("Quick", 0, 0.10, 60, 400)]
    [InlineData("Quick", 200, 0, 60, 400)]
    [InlineData("Quick", 200, 1.5, 60, 400)]
    [InlineData("Quick", 200, 0.10, 5, 400)]
    [InlineData("Quick", 200, 0.10, 60, -1)]
    public void AddBankingModule_WithMisconfiguredOffer_ShouldThrow(string name, decimal principal,
        decimal interestRate, int termSeconds, decimal requiredTurnover)
    {
        var offer = new LoanOfferDefinition(name, principal, interestRate, TimeSpan.FromSeconds(termSeconds), requiredTurnover);

        Assert.Throws<ArgumentException>(() => Register(CreateValidOptions(offers: [offer])));
    }
}
