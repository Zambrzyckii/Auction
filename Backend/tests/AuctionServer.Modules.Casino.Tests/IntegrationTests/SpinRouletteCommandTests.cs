using AuctionServer.Modules.Casino.Application.Command.SpinRoulette;
using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class SpinRouletteCommandTests(CasinoPostgresFixture fixture)
{
    private static readonly CasinoOptions Options = new(TimeSpan.FromMinutes(15),
        new RouletteOptions(1m, 1000m, 20),
        new BlackjackOptions(5m, 2000m, TimeSpan.FromMinutes(5)));

    private sealed class FixedCasinoRandom(int pocket) : ICasinoRandom
    {
        public int Next(int exclusiveMax) => pocket;
    }

    private async Task<RouletteSpinDto> HandleAsync(SpinRouletteCommand command, int pocket)
    {
        await using var context = fixture.CreateContext();
        var handler = new SpinRouletteCommandHandler(new CasinoRepository(context), new FixedCasinoRandom(pocket), Options);
        return await handler.Handle(command, CancellationToken.None);
    }

    private static RouletteBetRequest Red(decimal stake = 100m) => new(RouletteBetType.Red, null, stake);

    [Fact]
    public async Task Handle_WinningSpin_ShouldCreditChipsAndPersistSpin()
    {
        var account = await fixture.SeedAccountAsync(500m);

        var result = await HandleAsync(new SpinRouletteCommand(account.UserId, [Red()]), pocket: 32);

        Assert.Equal(32, result.Pocket);
        Assert.Equal("Red", result.Color);
        Assert.Equal(200m, result.TotalPayout);
        Assert.Equal(600m, result.Balance);

        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(600m, updatedAccount.Balance);

        await using var context = fixture.CreateContext();
        var spin = await context.RouletteSpins.AsNoTracking()
            .SingleAsync(s => s.PublicSpinId == result.PublicSpinId);
        Assert.Equal(100m, spin.TotalStake);
        Assert.Equal(200m, spin.TotalPayout);
        Assert.Single(spin.Bets);
    }

    [Fact]
    public async Task Handle_HedgedColorsOnZero_ShouldLoseWholeStake()
    {
        var account = await fixture.SeedAccountAsync(500m);
        var bets = new[] { Red(), new RouletteBetRequest(RouletteBetType.Black, null, 100m) };

        var result = await HandleAsync(new SpinRouletteCommand(account.UserId, bets), pocket: 0);

        Assert.Equal("Green", result.Color);
        Assert.Equal(0m, result.TotalPayout);
        Assert.Equal(300m, result.Balance);
    }

    [Fact]
    public async Task Handle_WhenStakesExceedChips_ShouldThrowWithoutSpinRow()
    {
        var account = await fixture.SeedAccountAsync(100m);
        var bets = new[] { Red(50m), new RouletteBetRequest(RouletteBetType.Black, null, 60m) };

        await Assert.ThrowsAsync<CasinoExceptions.InsufficientChipsException>(
            () => HandleAsync(new SpinRouletteCommand(account.UserId, bets), pocket: 17));

        await using var context = fixture.CreateContext();
        Assert.False(await context.RouletteSpins.AnyAsync(s => s.UserId == account.UserId));
    }

    [Fact]
    public async Task Handle_WhenNoAccount_ShouldThrowNotFound() =>
        await Assert.ThrowsAsync<CasinoExceptions.ChipAccountNotFoundException>(
            () => HandleAsync(new SpinRouletteCommand(Guid.NewGuid(), [Red()]), pocket: 17));

    [Fact]
    public async Task ConcurrentStakes_ShouldLoseOnVersionToken()
    {
        var account = await fixture.SeedAccountAsync(500m);

        await using var context1 = fixture.CreateContext();
        await using var context2 = fixture.CreateContext();
        var tracked1 = await context1.ChipAccounts.SingleAsync(a => a.UserId == account.UserId);
        var tracked2 = await context2.ChipAccounts.SingleAsync(a => a.UserId == account.UserId);

        tracked1.PlaceStake(100m);
        await context1.SaveChangesAsync();

        tracked2.PlaceStake(100m);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => context2.SaveChangesAsync());
    }
}
