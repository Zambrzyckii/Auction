using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Infrastructure.Background;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Warehouses;

public static class WarehouseModuleExtensions
{
    private static readonly string[] KnownRarities = ["Common", "Rare", "Epic", "Legendary"];

    public static IServiceCollection AddWarehousesModule(this IServiceCollection services, string connectionString,
        WarehousesOptions options)
    {
        ValidateOptions(options);

        services.AddDbContext<WarehouseDbContext>(o => o.UseNpgsql(connectionString));
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<WarehouseKeeper>();
        services.AddSingleton(options);
        services.AddScoped<IWarehouseRepository, WarehouseRepository>();

        return services;
    }

    private static void ValidateOptions(WarehousesOptions options)
    {
        if (options.PoolSize <= 0)
            throw new ArgumentException("Pool size must be greater than zero", nameof(options));
        if (options.MinPlayers < 2 || options.MaxPlayers < options.MinPlayers)
            throw new ArgumentException("Player limits need at least two players and max not below min", nameof(options));
        if (options.Tiers.Count == 0)
            throw new ArgumentException("At least one warehouse tier is required", nameof(options));
        if (options.EstimateVariants.Count == 0 || options.EstimateVariants.Any(v => v.Weight <= 0 || v.MinMultiplier <= 0 || v.MaxMultiplier < v.MinMultiplier))
            throw new ArgumentException("Estimate variants need positive weights and multipliers with min not above max", nameof(options));

        foreach (var tier in options.Tiers)
        {
            if (string.IsNullOrWhiteSpace(tier.Name) || tier.ItemCountMin < 1 || tier.ItemCountMax < tier.ItemCountMin
                || tier.EntryFee <= 0 || tier.Increments.Count == 0 || tier.Increments.Any(i => i <= 0)
                || tier.RarityWeights.Count == 0 || tier.RarityWeights.Any(w => w.Weight <= 0 || !KnownRarities.Contains(w.Rarity)))
                throw new ArgumentException($"Tier '{tier.Name}' is misconfigured", nameof(options));
        }
    }
}
