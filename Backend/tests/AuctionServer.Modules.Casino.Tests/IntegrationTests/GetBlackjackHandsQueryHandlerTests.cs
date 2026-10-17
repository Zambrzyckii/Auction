using AuctionServer.Modules.Casino.Application.Queries.GetBlackjackHands;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class GetBlackjackHandsQueryHandlerTests(CasinoPostgresFixture fixture)
{
    [Fact]
    public async Task Handle_ShouldReturnOnlyCompletedHands()
    {
        var userId = Guid.NewGuid();
        var completed = await fixture.SeedHandAsync(userId, "AS", "5H", "KD", "9C");
        await fixture.SeedHandAsync(userId);
        await fixture.SeedHandAsync(Guid.NewGuid(), "AS", "5H", "KD", "9C");

        await using var context = fixture.CreateContext();
        var handler = new GetBlackjackHandsQueryHandler(new CasinoRepository(context));
        var result = await handler.Handle(new GetBlackjackHandsQuery(userId), CancellationToken.None);

        var hand = Assert.Single(result);
        Assert.Equal(completed.PublicHandId, hand.PublicHandId);
        Assert.Equal(BlackjackOutcome.Blackjack, hand.Outcome);
        Assert.Equal(250m, hand.Payout);
        Assert.Equal(2, hand.DealerCards.Count);
    }
}
