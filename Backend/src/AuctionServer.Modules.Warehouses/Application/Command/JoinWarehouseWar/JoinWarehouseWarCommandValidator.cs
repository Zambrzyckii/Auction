using FluentValidation;

namespace AuctionServer.Modules.Warehouses.Application.Command.JoinWarehouseWar;

public sealed class JoinWarehouseWarCommandValidator : AbstractValidator<JoinWarehouseWarCommand>
{
    public JoinWarehouseWarCommandValidator()
    {
        RuleFor(x => x.PublicWarehouseId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
    }
}
