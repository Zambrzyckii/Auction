using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.RemoveFriend;

public sealed class RemoveFriendCommandValidator : AbstractValidator<RemoveFriendCommand>
{
    public RemoveFriendCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.OtherUserId).NotEmpty();
    }
}
