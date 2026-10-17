using FluentValidation;

namespace AuctionServer.Modules.Casino.Application.Command.CashOutChips;

public sealed class CashOutChipsCommandValidator : AbstractValidator<CashOutChipsCommand>
{
    public CashOutChipsCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0)
            .Must(amount => decimal.Round(amount, 2) == amount)
            .WithMessage("Amount cannot have more than two decimal places");
    }
}
