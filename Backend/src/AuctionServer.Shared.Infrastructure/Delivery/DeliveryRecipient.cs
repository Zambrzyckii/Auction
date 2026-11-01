using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public sealed class DeliveryRecipient
{
    public required string Name { get; init; }
    public required Func<IServiceProvider, INotification, CancellationToken, Task> Invoke { get; init; }

    public static DeliveryRecipient Of<TEvent, THandler>(string name)
        where TEvent : INotification
        where THandler : INotificationHandler<TEvent> =>
        new()
        {
            Name = name,
            Invoke = (services, notification, token) => services
                .GetServices<INotificationHandler<TEvent>>()
                .OfType<THandler>()
                .Single()
                .Handle((TEvent)notification, token)
        };
}
