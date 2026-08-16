using FluentValidation;

namespace AuctionServer.Modules.Wallets.Application.Command.AddFunds;

public sealed class AddFundsCommandValidator : AbstractValidator<AddFundsCommand>
{
    public AddFundsCommandValidator()
    {
        RuleFor(x => x.PublicUserId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}