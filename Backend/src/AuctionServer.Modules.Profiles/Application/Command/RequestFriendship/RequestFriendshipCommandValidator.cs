using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.RequestFriendship;

public sealed class RequestFriendshipCommandValidator : AbstractValidator<RequestFriendshipCommand>
{
    public RequestFriendshipCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.TargetUserId).NotEmpty();
    }
}
