using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Command.AddFunds;

public class AddFundsCommandHandler(IWalletRepository repository) : IRequestHandler<AddFundsCommand>
{
    public async Task Handle(AddFundsCommand request, CancellationToken token)
    {
        var userWallet = await repository.GetUserWalletByIdAsync(request.PublicUserId, token);
        userWallet.AddFunds(request.Amount);
        await repository.SaveUserFundsAsync(CancellationToken.None);
    }
}