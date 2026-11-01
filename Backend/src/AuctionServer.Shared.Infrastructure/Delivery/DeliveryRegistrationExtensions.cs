using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public static class DeliveryRegistrationExtensions
{
    public static IServiceCollection AddDeliveryProcessor(this IServiceCollection services)
    {
        services.AddHostedService(provider => new DeliveryProcessor(
            provider,
            provider.GetRequiredService<DeliveryRecipientRegistry>(),
            provider.GetRequiredService<ILogger<DeliveryProcessor>>()));
        return services;
    }
}
