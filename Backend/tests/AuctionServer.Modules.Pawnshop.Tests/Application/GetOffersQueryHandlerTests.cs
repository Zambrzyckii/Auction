using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Application.Queries.GetOffers;
using AuctionServer.Modules.Pawnshop.Domain.Enums;

namespace AuctionServer.Modules.Pawnshop.Tests.Application;

public class GetOffersQueryHandlerTests
{
    [Fact]
    public async Task Handle_ShouldExposePremisesTermsAndEveryTier()
    {
        var options = new PawnshopOptions(100000m, 1000000m, TimeSpan.FromMinutes(5),
            TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(15),
            [
                new BotTierDefinition("Pawn Clerk", PawnshopRarity.Common, 50000m, TimeSpan.FromSeconds(30), 0.5m),
                new BotTierDefinition("Magnate", PawnshopRarity.Legendary, 5000000m, TimeSpan.FromMinutes(5), 0.5m)
            ]);
        var handler = new GetOffersQueryHandler(options);

        var result = await handler.Handle(new GetOffersQuery(), CancellationToken.None);

        Assert.Equal(100000m, result.PremisesPrice);
        Assert.Equal(1000000m, result.PremisesRequiredTurnover);
        Assert.Equal(TimeSpan.FromMinutes(5), result.StockSellDelay);
        Assert.Equal(2, result.BotTiers.Count);
        Assert.Equal("Pawn Clerk", result.BotTiers[0].Name);
        Assert.Equal(PawnshopRarity.Legendary, result.BotTiers[1].Rarity);
        Assert.Equal(0.5m, result.BotTiers[1].PayoutRate);
    }
}
