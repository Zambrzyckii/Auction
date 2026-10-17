using FluentValidation;

namespace AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;

public sealed class StartBlackjackHandCommandValidator : AbstractValidator<StartBlackjackHandCommand>
{
    public StartBlackjackHandCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Stake).GreaterThan(0)
            .Must(stake => stake == decimal.Truncate(stake))
            .WithMessage("Stake must be a whole number of chips");
    }
}
