using MediatR;
namespace AuctionServer.Modules.Wallets.Application.Queries.GetWallet;

public record GetWalletQuery(Guid UserId) : IRequest<WalletDto>;