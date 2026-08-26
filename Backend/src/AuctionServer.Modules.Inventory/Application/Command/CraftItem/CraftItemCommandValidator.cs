using FluentValidation;

namespace AuctionServer.Modules.Inventory.Application.Command.CraftItem;

public sealed class CraftItemCommandValidator : AbstractValidator<CraftItemCommand>
{
    public CraftItemCommandValidator()
    {
        RuleFor(x => x.OwnerId).NotEmpty();
        RuleFor(x => x.IngredientsIds)
            .Cascade(CascadeMode.Stop)
            .NotNull()
            .Must(ids => ids.Count == 3).WithMessage("Crafting requires exactly 3 ingredients")
            .Must(ids => ids.Distinct().Count() == ids.Count).WithMessage("Ingredients must be distinct");
        RuleForEach(x => x.IngredientsIds).NotEmpty();
    }   
}