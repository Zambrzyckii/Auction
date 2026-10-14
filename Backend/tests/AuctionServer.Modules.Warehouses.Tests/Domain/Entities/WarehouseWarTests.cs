using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;

namespace AuctionServer.Modules.Warehouses.Tests.Domain.Entities;

public class WarehouseWarTests
{
    [Fact]
    public void Create_WhenEntryFeeIsPositive_ShouldStartStocking()
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Equal(WarehouseWarStatus.Stocking, war.Status);
        Assert.Equal("Small", war.Tier);
        Assert.Equal(500m, war.EntryFee);
        Assert.NotEqual(Guid.Empty, war.PublicWarehouseId);
        Assert.Null(war.CurrentLeaderId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public void Create_WhenEntryFeeIsNotPositive_ShouldThrowException(decimal entryFee)
    {
        Assert.Throws<WarehouseExceptions.InvalidEntryFeeException>(() => WarehouseWar.Create("Small", entryFee));
    }

    [Fact]
    public void OpenLobby_WhenStocking_ShouldStoreEstimatesAndOpen()
    {
        var war = WarehouseWar.Create("Small", 500m);
        var versionBeforeOpen = war.Version;

        war.OpenLobby(totalValue: 350m, estimateMin: 200m, estimateMax: 600m);

        Assert.Equal(WarehouseWarStatus.Open, war.Status);
        Assert.Equal(350m, war.TotalValue);
        Assert.Equal(200m, war.EstimateMin);
        Assert.Equal(600m, war.EstimateMax);
        Assert.NotEqual(versionBeforeOpen, war.Version);
    }

    [Fact]
    public void OpenLobby_WhenAlreadyOpen_ShouldThrowException()
    {
        var war = WarehouseWar.Create("Small", 500m);
        war.OpenLobby(350m, 200m, 600m);

        Assert.Throws<WarehouseExceptions.WarNotStockingException>(() => war.OpenLobby(350m, 200m, 600m));
    }

    [Theory]
    [InlineData(0, 200, 600)]
    [InlineData(350, 0, 600)]
    [InlineData(350, 700, 600)]
    public void OpenLobby_WhenValuesAreInvalid_ShouldThrowException(decimal totalValue, decimal min, decimal max)
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Throws<WarehouseExceptions.InvalidEstimateException>(() => war.OpenLobby(totalValue, min, max));
        Assert.Equal(WarehouseWarStatus.Stocking, war.Status);
    }
}
