using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Infrastructure.Background;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Inventory;

public static class InventoryModuleExtension
{
    public static IServiceCollection AddInventoryModule(this IServiceCollection services, string dbConnectionString)
    {
        services.AddDbContext<InventoryDbContext>(options =>
        {
            options.UseNpgsql(dbConnectionString);
        });

        services.AddScoped<IItemRepository, ItemRepository>();
        services.AddHostedService<OutboxProcessor>();

        return services;
    }
}