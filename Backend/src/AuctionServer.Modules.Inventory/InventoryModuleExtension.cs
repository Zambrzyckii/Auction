using AuctionServer.Modules.Inventory.Application;
using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Infrastructure.Background;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Inventory;

public static class InventoryModuleExtension
{
    public static IServiceCollection AddInventoryModule(this IServiceCollection services, string dbConnectionString,
        IReadOnlyList<StarterItemDefinition> starterItems)
    {
        if (starterItems.Any(item => string.IsNullOrWhiteSpace(item.Name)))
            throw new ArgumentException("Every starter item needs a name", nameof(starterItems));

        services.AddDbContext<InventoryDbContext>(options =>
        {
            options.UseNpgsql(dbConnectionString);
        });

        services.AddScoped<IItemRepository, ItemRepository>();
        services.AddHostedService<OutboxProcessor>();
        services.AddSingleton(new InventoryOptions(starterItems));

        return services;
    }
}