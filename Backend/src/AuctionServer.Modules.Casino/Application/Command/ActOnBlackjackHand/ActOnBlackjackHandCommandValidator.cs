using FluentValidation;

namespace AuctionServer.Modules.Casino.Application.Command.ActOnBlackjackHand;

public sealed class ActOnBlackjackHandCommandValidator : AbstractValidator<ActOnBlackjackHandCommand>
{
    public ActOnBlackjackHandCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.PublicHandId).NotEmpty();
        RuleFor(x => x.Action).IsInEnum();
    }
}
