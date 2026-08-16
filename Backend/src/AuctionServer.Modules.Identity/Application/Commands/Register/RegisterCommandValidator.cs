using FluentValidation;

namespace AuctionServer.Modules.Identity.Application.Commands.Register;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).Matches(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$");
        RuleFor(x => x.Username).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Surname).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Birthday).LessThan(DateOnly.FromDateTime(DateTime.UtcNow));
    }
}