using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Interfaces;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Application.Options;
using AuctionServer.Modules.Auctions.Infrastructure;
using AuctionServer.Modules.Auctions.Infrastructure.Background;
using AuctionServer.Modules.Auctions.Infrastructure.Caching;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Auctions;

public static class AuctionModuleExtensions
{
    public static IServiceCollection AddAuctionModule(this IServiceCollection services, string dbConnectionString,
        AuctionReadCacheOptions readCacheOptions)
    {
        ValidateReadCacheOptions(readCacheOptions);

        services.AddDbContext<AuctionDbContext>(options =>
        {
            options.UseNpgsql(dbConnectionString);
        });

        services.AddSingleton<ISqlConnectionFactory>(new SqlConnectionFactory(dbConnectionString));
        services.AddSingleton(readCacheOptions);
        services.AddSingleton<IAuctionReadCache, PassThroughAuctionReadCache>();
        services.AddScoped<IAuctionRepository, AuctionRepository>();
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<AuctionCloser>();
        return services;
    }

    private static void ValidateReadCacheOptions(AuctionReadCacheOptions options)
    {
        if (options is null)
            throw new ArgumentException("Read cache options are required", nameof(options));
        if (IsTtlOutOfRange(options.ListTtl) || IsTtlOutOfRange(options.DetailTtl) || IsTtlOutOfRange(options.BidsTtl))
            throw new ArgumentException("Read cache ttl values must be between one and sixty seconds", nameof(options));
    }

    private static bool IsTtlOutOfRange(TimeSpan ttl) =>
        ttl < TimeSpan.FromSeconds(1) || ttl > TimeSpan.FromSeconds(60);
}