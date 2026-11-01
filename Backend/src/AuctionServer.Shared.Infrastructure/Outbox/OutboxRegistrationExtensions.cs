using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Shared.Infrastructure.Outbox;

public static class OutboxRegistrationExtensions
{
    public static IServiceCollection AddOutboxProcessor<TContext>(this IServiceCollection services, string moduleName)
        where TContext : DbContext
    {
        services.AddHostedService(provider => new OutboxProcessor<TContext>(
            provider, moduleName, provider.GetRequiredService<ILogger<OutboxProcessor<TContext>>>()));
        return services;
    }
}
