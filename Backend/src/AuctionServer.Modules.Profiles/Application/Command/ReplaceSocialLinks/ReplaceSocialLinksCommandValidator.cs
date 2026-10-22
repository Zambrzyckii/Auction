using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Command.ReplaceSocialLinks;

public sealed class ReplaceSocialLinksCommandValidator : AbstractValidator<ReplaceSocialLinksCommand>
{
    public ReplaceSocialLinksCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Links).NotNull();
        RuleForEach(x => x.Links).ChildRules(link =>
        {
            link.RuleFor(l => l.Platform).IsInEnum();
            link.RuleFor(l => l.Url).NotEmpty().MaximumLength(200);
        });
    }
}
