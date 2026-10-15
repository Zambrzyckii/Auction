using FluentValidation;

namespace AuctionServer.Modules.Pawnshop.Application.Command.BuyBot;

public sealed class BuyBotCommandValidator : AbstractValidator<BuyBotCommand>
{
    public BuyBotCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.TierName).NotEmpty().MaximumLength(64);
    }
}
