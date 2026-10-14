using FluentValidation;

namespace AuctionServer.Modules.Warehouses.Application.Command.LeaveWarehouseWar;

public sealed class LeaveWarehouseWarCommandValidator : AbstractValidator<LeaveWarehouseWarCommand>
{
    public LeaveWarehouseWarCommandValidator()
    {
        RuleFor(x => x.PublicWarehouseId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
    }
}
