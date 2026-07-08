using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Command.AddFunds;

public record AddFundsCommand(Guid PublicUserId, decimal Amount) : IRequest;