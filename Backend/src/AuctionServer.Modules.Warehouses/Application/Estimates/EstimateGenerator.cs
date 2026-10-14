using AuctionServer.Modules.Warehouses.Application.Options;

namespace AuctionServer.Modules.Warehouses.Application.Estimates;

public static class EstimateGenerator
{
    private const decimal MinimumBound = 10m;

    public static (decimal Min, decimal Max) Generate(decimal totalValue, IReadOnlyList<EstimateVariant> variants)
    {
        var variant = RollVariant(variants);
        var min = RoundToTens(totalValue * variant.MinMultiplier);
        var max = RoundToTens(totalValue * variant.MaxMultiplier);
        return (Math.Max(min, MinimumBound), Math.Max(max, MinimumBound));
    }

    private static EstimateVariant RollVariant(IReadOnlyList<EstimateVariant> variants)
    {
        var roll = Random.Shared.Next(variants.Sum(v => v.Weight));
        foreach (var variant in variants)
        {
            roll -= variant.Weight;
            if (roll < 0) return variant;
        }

        return variants[^1];
    }

    private static decimal RoundToTens(decimal value) => Math.Round(value / 10m) * 10m;
}
