using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Modules.Wallets.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class CasinoChipPurchaseRequestedEventHandler(IWalletRepository repository) : INotificationHandler<CasinoChipPurchaseRequestedEvent>
{
    public async Task Handle(CasinoChipPurchaseRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

        var replyId = Guid.NewGuid();
        OutboxMessage reply;
        try
        {
            wallet.Withdraw(notification.Amount);
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(CasinoChipPurchaseCompletedEvent),
                Content = JsonSerializer.Serialize(new CasinoChipPurchaseCompletedEvent(
                    replyId, notification.PublicPurchaseId, notification.UserId))
            };
        }
        catch (WalletExceptions.InsufficientFundsException e)
        {
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(CasinoChipPurchaseRejectedEvent),
                Content = JsonSerializer.Serialize(new CasinoChipPurchaseRejectedEvent(
                    replyId, notification.PublicPurchaseId, notification.UserId, e.Message))
            };
        }

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveUserFundsWithInboxAndOutboxAsync(processedMessage, reply, CancellationToken.None);
        }
        catch (WalletExceptions.EventAlreadyProcessedException)
        {
        }
    }
}
