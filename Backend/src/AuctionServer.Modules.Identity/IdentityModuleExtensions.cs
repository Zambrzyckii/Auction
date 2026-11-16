using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Identity;

public static class IdentityModuleExtensions
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<IdentityDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddSingleton<JwtTokenFactory>();

        services.AddOutboxProcessor<IdentityDbContext>("Identity");
        
        return services;
    }
}