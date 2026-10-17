using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Cards;
using AuctionServer.Modules.Casino.Infrastructure.Background;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Modules.Casino.Infrastructure.Random;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Casino;

public static class CasinoModuleExtensions
{
    private static readonly TimeSpan MinimumTimeout = TimeSpan.FromMinutes(10);

    public static IServiceCollection AddCasinoModule(this IServiceCollection services, string connectionString,
        CasinoOptions options)
    {
        ValidateOptions(options);

        services.AddDbContext<CasinoDbContext>(o => o.UseNpgsql(connectionString));
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<CasinoKeeper>();
        services.AddSingleton(options);
        services.AddSingleton<ICasinoRandom, CasinoRandom>();
        services.AddSingleton<ICardSource, ShoeCardSource>();
        services.AddScoped<ICasinoRepository, CasinoRepository>();

        return services;
    }

    private static void ValidateOptions(CasinoOptions options)
    {
        if (options.Roulette is null || options.Blackjack is null)
            throw new ArgumentException("Roulette and Blackjack sections are required", nameof(options));
        if (options.PurchaseTimeout < MinimumTimeout)
            throw new ArgumentException("Purchase timeout must outlast the ten-minute dead-letter horizon of a saga round trip", nameof(options));
        if (options.Roulette.MaxBetsPerSpin is < 1 or > 50)
            throw new ArgumentException("Max bets per spin must be between one and fifty", nameof(options));
        if (options.Blackjack.HandTimeout < TimeSpan.FromSeconds(30) || options.Blackjack.HandTimeout > TimeSpan.FromDays(1))
            throw new ArgumentException("Hand timeout must be between thirty seconds and one day", nameof(options));

        foreach (var (game, minBet, maxBet) in new[]
                 {
                     ("Roulette", options.Roulette.MinBet, options.Roulette.MaxBet),
                     ("Blackjack", options.Blackjack.MinBet, options.Blackjack.MaxBet)
                 })
        {
            if (minBet < 1 || maxBet < minBet
                || minBet != decimal.Truncate(minBet) || maxBet != decimal.Truncate(maxBet))
                throw new ArgumentException($"{game} bet limits must be whole chips with MinBet between one and MaxBet", nameof(options));
        }
    }
}
