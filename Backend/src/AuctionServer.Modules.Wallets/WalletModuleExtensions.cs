using AuctionServer.Modules.Wallets.Application;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Wallets;

public static class WalletModuleExtensions
{
    public static IServiceCollection AddWalletsModule(this IServiceCollection services, string connectionString, decimal startingFunds)
    {
        if (startingFunds <= 0)
            throw new ArgumentOutOfRangeException(nameof(startingFunds), startingFunds,
                "Starting funds must be greater than zero");
        
        services.AddDbContext<WalletDbContext>(options => options.UseNpgsql(connectionString));
        services.AddSingleton(new WalletsOptions(startingFunds));
        services.AddScoped<IWalletRepository, WalletRepository>();
        return services;
    }
}