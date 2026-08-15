using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Wallets;

public static class WalletModuleExtensions
{
    public static IServiceCollection AddWalletsModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<WalletDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IWalletRepository, WalletRepository>();
        
        return services;
    }
}