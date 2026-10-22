using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.SetProfilePrivacy;

public sealed class SetProfilePrivacyCommandValidator : AbstractValidator<SetProfilePrivacyCommand>
{
    public SetProfilePrivacyCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
    }
}
