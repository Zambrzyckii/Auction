using AuctionServer.Modules.Warehouses.Application.Estimates;
using AuctionServer.Modules.Warehouses.Application.Options;

namespace AuctionServer.Modules.Warehouses.Tests.Application;

public class EstimateGeneratorTests
{
    [Fact]
    public void Generate_WithSingleVariant_ShouldScaleValueWithinVariant()
    {
        var variants = new List<EstimateVariant> { new(Weight: 1, MinMultiplier: 0.3m, MaxMultiplier: 0.7m) };

        var (min, max) = EstimateGenerator.Generate(1000m, variants);

        Assert.True(min <= max);
        Assert.Equal(0m, min % 10);
        Assert.Equal(0m, max % 10);
        Assert.InRange(min, 290m, 310m);
        Assert.InRange(max, 690m, 710m);
    }

    [Fact]
    public void Generate_ShouldPickOneOfConfiguredVariants()
    {
        var variants = new List<EstimateVariant>
        {
            new(Weight: 1, MinMultiplier: 0.3m, MaxMultiplier: 0.7m),
            new(Weight: 1, MinMultiplier: 1.3m, MaxMultiplier: 2.5m)
        };

        for (var i = 0; i < 20; i++)
        {
            var (min, max) = EstimateGenerator.Generate(1000m, variants);

            var withinLow = min >= 290m && max <= 710m;
            var withinHigh = min >= 1290m && max <= 2510m;
            Assert.True(withinLow || withinHigh, $"({min}, {max}) fits no configured variant");
        }
    }

    [Fact]
    public void Generate_WhenValueIsTiny_ShouldKeepPositiveRoundedBounds()
    {
        var variants = new List<EstimateVariant> { new(Weight: 1, MinMultiplier: 0.3m, MaxMultiplier: 0.7m) };

        var (min, max) = EstimateGenerator.Generate(7m, variants);

        Assert.True(min >= 10m);
        Assert.True(max >= min);
        Assert.Equal(0m, min % 10);
        Assert.Equal(0m, max % 10);
    }
}
