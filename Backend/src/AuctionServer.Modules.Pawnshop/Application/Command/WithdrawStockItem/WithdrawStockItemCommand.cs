using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Command.WithdrawStockItem;

public record WithdrawStockItemCommand(Guid UserId, Guid PublicStockItemId) : IRequest;
