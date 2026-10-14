using FluentValidation;

namespace AuctionServer.Modules.Wallets.Application.Command.TransferFunds;

public sealed class TransferFundsCommandValidator : AbstractValidator<TransferFundsCommand>
{
    public TransferFundsCommandValidator()
    {
        RuleFor(x => x.SenderUserId).NotEmpty();
        RuleFor(x => x.RecipientUserId).NotEmpty()
            .NotEqual(x => x.SenderUserId).WithMessage("Cannot transfer funds to yourself");
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}
