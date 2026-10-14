using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Queries.GetWalletTransfers;

public class GetWalletTransfersQueryHandler(IWalletRepository repository) : IRequestHandler<GetWalletTransfersQuery, List<TransferDto>>
{
    public async Task<List<TransferDto>> Handle(GetWalletTransfersQuery request, CancellationToken token)
    {
        await repository.GetUserWalletByIdAsyncReadOnly(request.UserId, token);

        var transfers = await repository.GetUserTransfersReadOnlyAsync(request.UserId, token);
        return transfers.Select(t => new TransferDto(t.SenderUserId, t.RecipientUserId, t.Amount, t.SentOn)).ToList();
    }
}
