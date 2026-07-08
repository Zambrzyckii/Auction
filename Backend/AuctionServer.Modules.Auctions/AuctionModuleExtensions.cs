using AuctionServer.Modules.Auctions.Application.Interfaces;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Infrastructure;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Auctions;

public static class AuctionModuleExtensions
{
    public static IServiceCollection AddAuctionModule(this IServiceCollection services, string dbConnectionString)
    {
        services.AddDbContext<AuctionDbContext>(options =>
        {
            options.UseNpgsql(dbConnectionString);
        });

        services.AddSingleton<ISqlConnectionFactory>(new SqlConnectionFactory(dbConnectionString));
        services.AddScoped<IAuctionRepository, AuctionRepository>();
        return services;
    }
}