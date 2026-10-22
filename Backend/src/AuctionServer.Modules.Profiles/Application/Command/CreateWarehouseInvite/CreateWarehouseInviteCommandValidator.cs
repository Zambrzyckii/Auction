using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.CreateWarehouseInvite;

public sealed class CreateWarehouseInviteCommandValidator : AbstractValidator<CreateWarehouseInviteCommand>
{
    public CreateWarehouseInviteCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.FriendUserId).NotEmpty();
        RuleFor(x => x.PublicWarehouseId).NotEmpty();
    }
}
