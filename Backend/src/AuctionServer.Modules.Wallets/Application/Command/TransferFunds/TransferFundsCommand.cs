using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Command.TransferFunds;

public record TransferFundsCommand(Guid SenderUserId, Guid RecipientUserId, decimal Amount) : IRequest;
