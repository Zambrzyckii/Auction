using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class AuctionFinishedEventHandler(IWalletRepository repository) : INotificationHandler<AuctionFinishedEvent>
{
    public Task Handle(AuctionFinishedEvent notification, CancellationToken cancellationToken)
    {
        if (notification.WinnerUserId is null || notification.FinalPrice is null) return Task.CompletedTask;

        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var winnerWallet = await repository.GetUserWalletByIdAsync(notification.WinnerUserId.Value, cancellationToken);
            var sellerWallet = await repository.GetUserWalletByIdAsync(notification.SellerUserId, cancellationToken);

            var amount = winnerWallet.ConsumeLock(notification.PublicAuctionId);
            sellerWallet.AddFunds(amount);

            var eventId = Guid.NewGuid();
            return (OutboxMessage?)new OutboxMessage
            {
                Id = eventId,
                Type = nameof(AuctionSettledEvent),
                Content = JsonSerializer.Serialize(new AuctionSettledEvent(
                    eventId, notification.PublicAuctionId, notification.SellerUserId, notification.WinnerUserId.Value, amount))
            };
        }, cancellationToken);
    }
}
