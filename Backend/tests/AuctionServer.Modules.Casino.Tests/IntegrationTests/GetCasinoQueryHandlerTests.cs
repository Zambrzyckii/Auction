using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Application.Queries.GetCasino;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class GetCasinoQueryHandlerTests(CasinoPostgresFixture fixture)
{
    private static readonly CasinoOptions Options = new(TimeSpan.FromMinutes(15),
        new RouletteOptions(1m, 1000m, 20),
        new BlackjackOptions(5m, 2000m, TimeSpan.FromMinutes(5)));

    private async Task<CasinoDto> HandleAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetCasinoQueryHandler(new CasinoRepository(context), Options);
        return await handler.Handle(new GetCasinoQuery(userId), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WithActiveHand_ShouldExposeAutoStandDeadline()
    {
        var account = await fixture.SeedAccountAsync(400m);
        var hand = await fixture.SeedHandAsync(account.UserId, DateTime.UtcNow.AddMinutes(-3));

        var dto = await HandleAsync(account.UserId);

        var storedHand = await fixture.GetHandAsync(hand.PublicHandId);
        Assert.NotNull(dto.ActiveBlackjackHand);
        Assert.Equal(storedHand.LastActionOn + Options.Blackjack.HandTimeout, dto.ActiveBlackjackHand.AutoStandOn);
    }
}
