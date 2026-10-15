using AuctionServer.Modules.Pawnshop.Application.Queries.GetPawnshop;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class GetPawnshopQueryHandlerTests(PawnshopPostgresFixture fixture)
{
    private async Task<PawnshopDto> HandleAsync(GetPawnshopQuery query)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetPawnshopQueryHandler(new PawnshopRepository(context));
        return await handler.Handle(query, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldReturnLatestShopIncludingRejection()
    {
        var userId = Guid.NewGuid();
        await fixture.SeedShopAsync(ShopStatus.Rejected, userId);
        var latest = await fixture.SeedShopAsync(ShopStatus.PendingPayment, userId);

        var result = await HandleAsync(new GetPawnshopQuery(userId));

        Assert.Equal(latest.PublicPawnshopId, result.PublicPawnshopId);
        Assert.Equal(ShopStatus.PendingPayment, result.Status);
    }

    [Fact]
    public async Task Handle_WhenOnlyRejectedShopExists_ShouldExposeReason()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Rejected);

        var result = await HandleAsync(new GetPawnshopQuery(seeded.UserId));

        Assert.Equal(ShopStatus.Rejected, result.Status);
        Assert.Equal("Seeded as rejected", result.RejectionReason);
    }

    [Fact]
    public async Task Handle_WhenNoShop_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<PawnshopExceptions.PawnshopNotFoundException>(
            () => HandleAsync(new GetPawnshopQuery(Guid.NewGuid())));
    }

    [Fact]
    public async Task Handle_ShouldNotSeeForeignShop()
    {
        await fixture.SeedShopAsync(ShopStatus.Active);

        await Assert.ThrowsAsync<PawnshopExceptions.PawnshopNotFoundException>(
            () => HandleAsync(new GetPawnshopQuery(Guid.NewGuid())));
    }
}
