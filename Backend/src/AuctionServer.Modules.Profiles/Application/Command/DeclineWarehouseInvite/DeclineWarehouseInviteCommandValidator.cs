using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.DeclineWarehouseInvite;

public sealed class DeclineWarehouseInviteCommandValidator : AbstractValidator<DeclineWarehouseInviteCommand>
{
    public DeclineWarehouseInviteCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.PublicInviteId).NotEmpty();
    }
}
