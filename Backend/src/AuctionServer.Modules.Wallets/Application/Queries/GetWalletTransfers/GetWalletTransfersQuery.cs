using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Queries.GetWalletTransfers;

public record GetWalletTransfersQuery(Guid UserId) : IRequest<List<TransferDto>>;
