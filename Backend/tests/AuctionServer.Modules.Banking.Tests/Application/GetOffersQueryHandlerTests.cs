using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Application.Queries.GetOffers;

namespace AuctionServer.Modules.Banking.Tests.Application;

public class GetOffersQueryHandlerTests
{
    [Fact]
    public async Task Handle_ShouldQuoteEveryConfiguredOffer()
    {
        var options = new BankingOptions(0.20m, TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(15),
            TimeSpan.FromMinutes(15),
            [
                new LoanOfferDefinition("Quick", 200m, 0.10m, TimeSpan.FromMinutes(1), 400m),
                new LoanOfferDefinition("Standard", 1000m, 0.15m, TimeSpan.FromMinutes(10), 2000m)
            ]);
        var handler = new GetOffersQueryHandler(options);

        var offers = await handler.Handle(new GetOffersQuery(), CancellationToken.None);

        Assert.Equal(2, offers.Count);
        var quick = offers.Single(o => o.Name == "Quick");
        Assert.Equal(200m, quick.Principal);
        Assert.Equal(220m, quick.TotalDue);
        Assert.Equal(400m, quick.RequiredTurnover);
        var standard = offers.Single(o => o.Name == "Standard");
        Assert.Equal(1150m, standard.TotalDue);
    }
}
