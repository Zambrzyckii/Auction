using FluentValidation;

namespace AuctionServer.Modules.Inventory.Application.Command.GrantItem;

public sealed class GrantItemCommandValidator : AbstractValidator<GrantItemCommand>
{
    public GrantItemCommandValidator()
    {
        RuleFor(x => x.OwnerId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Rarity).IsInEnum();
    }
}