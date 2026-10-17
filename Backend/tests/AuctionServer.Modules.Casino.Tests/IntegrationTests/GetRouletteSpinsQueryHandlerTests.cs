using AuctionServer.Modules.Casino.Application.Queries.GetRouletteSpins;
using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class GetRouletteSpinsQueryHandlerTests(CasinoPostgresFixture fixture)
{
    private static readonly DateTime Now = new(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);

    private async Task<RouletteSpin> SeedSpinAsync(Guid userId, int pocket, DateTime placedOn)
    {
        await using var context = fixture.CreateContext();
        var bets = new[] { new RouletteBet { Type = RouletteBetType.Red, Stake = 100m } };
        var spin = RouletteSpin.Resolve(userId, bets, pocket, 1m, 1000m, 20, placedOn);
        context.RouletteSpins.Add(spin);
        await context.SaveChangesAsync();
        return spin;
    }

    [Fact]
    public async Task Handle_ShouldReturnLatestSpinsWithBets()
    {
        var userId = Guid.NewGuid();
        await SeedSpinAsync(userId, 32, Now);
        var latest = await SeedSpinAsync(userId, 0, Now.AddMinutes(1));
        await SeedSpinAsync(Guid.NewGuid(), 17, Now.AddMinutes(2));

        await using var context = fixture.CreateContext();
        var handler = new GetRouletteSpinsQueryHandler(new CasinoRepository(context));
        var result = await handler.Handle(new GetRouletteSpinsQuery(userId), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal(latest.PublicSpinId, result[0].PublicSpinId);
        Assert.Equal("Green", result[0].Color);
        Assert.Equal(200m, result[1].TotalPayout);
        Assert.All(result, s => Assert.Single(s.Bets));
    }
}
