using FluentValidation;

namespace AuctionServer.Modules.Casino.Application.Command.PurchaseChips;

public sealed class PurchaseChipsCommandValidator : AbstractValidator<PurchaseChipsCommand>
{
    public PurchaseChipsCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0)
            .Must(amount => amount == decimal.Truncate(amount))
            .WithMessage("Amount must be a whole number of chips");
    }
}
