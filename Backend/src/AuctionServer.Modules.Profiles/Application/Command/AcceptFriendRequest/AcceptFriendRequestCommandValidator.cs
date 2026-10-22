using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.AcceptFriendRequest;

public sealed class AcceptFriendRequestCommandValidator : AbstractValidator<AcceptFriendRequestCommand>
{
    public AcceptFriendRequestCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.PublicFriendshipId).NotEmpty();
    }
}
