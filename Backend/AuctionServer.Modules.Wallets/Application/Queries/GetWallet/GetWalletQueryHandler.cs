using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Queries.GetWallet;

public class GetWalletQueryHandler(IWalletRepository repository) : IRequestHandler<GetWalletQuery, WalletDto>
{
    public async Task<WalletDto> Handle(GetWalletQuery request, CancellationToken token)
    {
        var wallet = await repository.GetUserWalletByIdAsyncReadOnly(request.UserId, token);

        return new WalletDto(wallet!.AvailableFunds, wallet.LockedFunds);
    }
}