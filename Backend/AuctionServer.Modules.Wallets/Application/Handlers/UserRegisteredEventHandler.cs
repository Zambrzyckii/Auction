using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class UserRegisteredEventHandler(IWalletRepository repository) : INotificationHandler<UserRegisteredEvent>
{
    public async Task Handle(UserRegisteredEvent notification, CancellationToken token)
    {
        var wallet = new Wallet { UserId = notification.PublicUserId };
        try
        {
            await repository.AddWalletAsync(wallet, token);
        }
        catch (WalletExceptions.WalletAlreadyExistException)
        {
        }
    }
}