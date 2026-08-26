using FluentValidation;

namespace AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;

public sealed class SellItemToShopCommandValidator : AbstractValidator<SellItemToShopCommand>
{
    public SellItemToShopCommandValidator()
    {
        RuleFor(x => x.OwnerId).NotEmpty();
        RuleFor(x => x.ItemId).NotEmpty();
    }
}