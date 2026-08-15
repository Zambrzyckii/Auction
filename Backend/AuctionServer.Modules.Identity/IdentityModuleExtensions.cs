using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Infrastructure.Background;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Identity;

public static class IdentityModuleExtensions
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<IdentityDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IAuthRepository, AuthRepository>();

        services.AddHostedService<OutboxProcessor>();
        
        return services;
    }
}