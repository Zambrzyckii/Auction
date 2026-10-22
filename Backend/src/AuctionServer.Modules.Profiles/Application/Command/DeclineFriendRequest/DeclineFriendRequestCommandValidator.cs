using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.DeclineFriendRequest;

public sealed class DeclineFriendRequestCommandValidator : AbstractValidator<DeclineFriendRequestCommand>
{
    public DeclineFriendRequestCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.PublicFriendshipId).NotEmpty();
    }
}
