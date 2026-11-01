using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Interfaces;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Application.Options;
using AuctionServer.Modules.Auctions.Infrastructure;
using AuctionServer.Modules.Auctions.Infrastructure.Background;
using AuctionServer.Modules.Auctions.Infrastructure.Caching;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Auctions;

public static class AuctionModuleExtensions
{
    public static IServiceCollection AddAuctionModule(this IServiceCollection services, string dbConnectionString,
        AuctionReadCacheOptions readCacheOptions, bool readCacheEnabled)
    {
        ValidateReadCacheOptions(readCacheOptions);

        services.AddDbContext<AuctionDbContext>(options =>
        {
            options.UseNpgsql(dbConnectionString);
        });

        services.AddSingleton<ISqlConnectionFactory>(new SqlConnectionFactory(dbConnectionString));
        services.AddSingleton(readCacheOptions);
        if (readCacheEnabled)
        {
            services.AddSingleton<AuctionCacheMetrics>();
            services.AddSingleton<IAuctionReadCache, HybridAuctionReadCache>();
        }
        else
            services.AddSingleton<IAuctionReadCache, PassThroughAuctionReadCache>();
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>));
        services.AddScoped<IAuctionRepository, AuctionRepository>();
        services.AddOutboxProcessor<AuctionDbContext>("Auctions");
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