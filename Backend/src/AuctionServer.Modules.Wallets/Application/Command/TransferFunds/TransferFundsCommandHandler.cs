using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Command.TransferFunds;

public class TransferFundsCommandHandler(IWalletRepository repository) : IRequestHandler<TransferFundsCommand>
{
    public async Task Handle(TransferFundsCommand request, CancellationToken token)
    {
        var senderWallet = await repository.GetUserWalletByIdAsync(request.SenderUserId, token);
        var recipientWallet = await repository.GetUserWalletByIdAsync(request.RecipientUserId, token);

        senderWallet.Withdraw(request.Amount);
        recipientWallet.AddFunds(request.Amount);

        var transfer = new Transfer
        {
            SenderUserId = request.SenderUserId,
            RecipientUserId = request.RecipientUserId,
            Amount = request.Amount
        };
        await repository.SaveTransferAsync(transfer, CancellationToken.None);
    }
}
