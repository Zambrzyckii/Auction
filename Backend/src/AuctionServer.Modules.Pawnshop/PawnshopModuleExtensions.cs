using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Infrastructure.Background;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Pawnshop;

public static class PawnshopModuleExtensions
{
    // Both saga legs retry with exponential backoff for about five minutes before dead-lettering,
    // so a request plus its reply can stay legitimately in flight for about ten minutes. A timeout
    // below that would let the keeper's safety nets fire while a reply can still arrive.
    private static readonly TimeSpan MinimumTimeout = TimeSpan.FromMinutes(10);

    public static IServiceCollection AddPawnshopModule(this IServiceCollection services, string connectionString,
        PawnshopOptions options)
    {
        ValidateOptions(options);

        services.AddDbContext<PawnshopDbContext>(o => o.UseNpgsql(connectionString));
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<PawnshopKeeper>();
        services.AddSingleton(options);
        services.AddScoped<IPawnshopRepository, PawnshopRepository>();

        return services;
    }

    private static void ValidateOptions(PawnshopOptions options)
    {
        if (options.PremisesPrice <= 0)
            throw new ArgumentException("Premises price must be positive", nameof(options));
        if (options.PremisesRequiredTurnover < 0)
            throw new ArgumentException("Premises required turnover cannot be negative", nameof(options));
        if (options.StockSellDelay < TimeSpan.FromSeconds(30) || options.StockSellDelay > TimeSpan.FromDays(7))
            throw new ArgumentException("Stock sell delay must be between thirty seconds and seven days", nameof(options));
        if (options.StockRequestTimeout < MinimumTimeout || options.PaymentTimeout < MinimumTimeout)
            throw new ArgumentException("Timeouts must outlast the ten-minute dead-letter horizon of a saga round trip", nameof(options));
        if (options.BotTiers.Count == 0)
            throw new ArgumentException("At least one bot tier is required", nameof(options));
        if (options.BotTiers.Select(t => t.Name.ToLowerInvariant()).Distinct().Count() != options.BotTiers.Count)
            throw new ArgumentException("Bot tier names must be unique", nameof(options));
        if (options.BotTiers.Select(t => t.Rarity).Distinct().Count() != options.BotTiers.Count)
            throw new ArgumentException("Bot tier rarities must be unique", nameof(options));

        foreach (var tier in options.BotTiers)
        {
            if (string.IsNullOrWhiteSpace(tier.Name) || tier.Name.Length > 64
                || !Enum.IsDefined(tier.Rarity)
                || tier.Price <= 0 || tier.SpawnInterval < TimeSpan.FromSeconds(10)
                || tier.PayoutRate < 0.01m || tier.PayoutRate >= 1
                || options.StockSellDelay > tier.SpawnInterval * 100)
                throw new ArgumentException($"Bot tier '{tier.Name}' is misconfigured", nameof(options));
        }
    }
}
