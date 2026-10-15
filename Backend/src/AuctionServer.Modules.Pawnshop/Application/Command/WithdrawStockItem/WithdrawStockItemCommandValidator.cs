using FluentValidation;

namespace AuctionServer.Modules.Pawnshop.Application.Command.WithdrawStockItem;

public sealed class WithdrawStockItemCommandValidator : AbstractValidator<WithdrawStockItemCommand>
{
    public WithdrawStockItemCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.PublicStockItemId).NotEmpty();
    }
}
