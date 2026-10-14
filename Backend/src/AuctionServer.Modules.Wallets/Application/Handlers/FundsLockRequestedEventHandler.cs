using System.Diagnostics;
using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Modules.Wallets.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class FundsLockRequestedEventHandler(IWalletRepository repository) : INotificationHandler<FundsLockRequestedEvent>
{
    public async Task Handle(FundsLockRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.BidderUserId, cancellationToken);

        var replyId = Guid.NewGuid();
        OutboxMessage reply;
        try
        {
            wallet.LockFunds(notification.PublicAuctionId, notification.Amount);
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(FundsLockedEvent),
                Content = JsonSerializer.Serialize(new FundsLockedEvent(replyId, notification.PublicAuctionId,
                    notification.BidderUserId, notification.Amount))
            };
        }
        catch (Exception e) when (e is WalletExceptions.InsufficientFundsException
                                      or WalletExceptions.LockAlreadyExistsException)
        {
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(FundsLockRejectedEvent),
                Content = JsonSerializer.Serialize(new FundsLockRejectedEvent(
                    replyId, notification.PublicAuctionId, notification.BidderUserId, e.Message))
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