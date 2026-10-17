using FluentValidation;

namespace AuctionServer.Modules.Casino.Application.Command.SpinRoulette;

public sealed class SpinRouletteCommandValidator : AbstractValidator<SpinRouletteCommand>
{
    public SpinRouletteCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Bets).NotEmpty();
        RuleForEach(x => x.Bets).ChildRules(bet =>
        {
            bet.RuleFor(b => b.Type).IsInEnum();
            bet.RuleFor(b => b.Stake).GreaterThan(0);
        });
    }
}
