using FluentValidation;

namespace AuctionServer.Modules.Warehouses.Application.Command.PlaceWarehouseBid;

public sealed class PlaceWarehouseBidCommandValidator : AbstractValidator<PlaceWarehouseBidCommand>
{
    public PlaceWarehouseBidCommandValidator()
    {
        RuleFor(x => x.PublicWarehouseId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Increment).GreaterThan(0);
    }
}
