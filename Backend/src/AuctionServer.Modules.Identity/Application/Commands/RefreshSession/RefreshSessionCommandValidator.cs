using FluentValidation;

namespace AuctionServer.Modules.Identity.Application.Commands.RefreshSession;

public sealed class RefreshSessionCommandValidator : AbstractValidator<RefreshSessionCommand>
{
    public RefreshSessionCommandValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(128);
    }
}
