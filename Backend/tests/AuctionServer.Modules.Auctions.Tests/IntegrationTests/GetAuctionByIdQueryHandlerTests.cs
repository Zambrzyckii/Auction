using AuctionServer.Modules.Auctions.Application.Queries.GetAuctionById;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class GetAuctionByIdQueryHandlerTests(AuctionsPostgresFixture fixture)
{
    private async Task<AuctionByIdQueryDto> HandleAsync(Guid publicAuctionId)
    {
        var handler = new GetAuctionByIdQueryHandler(new SqlConnectionFactory(fixture.ConnectionString));
        return await handler.Handle(new GetAuctionByIdQuery(publicAuctionId), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenAuctionIsActive_ShouldReturnItemSnapshot()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);

        var dto = await HandleAsync(seeded.PublicAuctionId);

        Assert.Equal(seeded.PublicAuctionId, dto.PublicAuctionId);
        Assert.Equal(seeded.SellerUserId, dto.SellerUserId);
        Assert.Equal(AuctionStatus.Active, dto.Status);
        Assert.Equal(10m, dto.CurrentPrice);
        Assert.Equal("Seeded Item", dto.ItemName);
        Assert.Equal("Common", dto.ItemRarity);
        Assert.Equal(50m, dto.ItemOfficialPrice);
        Assert.Null(dto.CancellationReason);
    }

    [Fact]
    public async Task Handle_WhenAuctionIsPending_ShouldReturnPendingWithoutSnapshot()
    {
        var seeded = await fixture.SeedAuctionAsync();

        var dto = await HandleAsync(seeded.PublicAuctionId);

        Assert.Equal(AuctionStatus.Pending, dto.Status);
        Assert.Null(dto.ItemName);
        Assert.Null(dto.ItemRarity);
        Assert.Null(dto.ItemOfficialPrice);
    }

    [Fact]
    public async Task Handle_WhenAuctionIsCancelled_ShouldReturnCancellationReason()
    {
        var seeded = await fixture.SeedAuctionAsync();
        await fixture.CancelAuctionAsync(seeded.PublicAuctionId, "Item is not available");

        var dto = await HandleAsync(seeded.PublicAuctionId);

        Assert.Equal(AuctionStatus.Cancelled, dto.Status);
        Assert.Equal("Item is not available", dto.CancellationReason);
    }

    [Fact]
    public async Task Handle_WhenAuctionDoesNotExist_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<AuctionExceptions.AuctionNotFoundException>(() => HandleAsync(Guid.NewGuid()));
    }
}