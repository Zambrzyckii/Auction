using FluentValidation;

namespace AuctionServer.Modules.Identity.Application.Commands.RegisterBot;

public sealed class RegisterBotCommandValidator : AbstractValidator<RegisterBotCommand>
{
    public RegisterBotCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        // Password: min 8 chars, lowercase, uppercase, digit and special character
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).Matches(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$");
        RuleFor(x => x.Username).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Surname).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Birthday).LessThan(_ => DateOnly.FromDateTime(DateTime.UtcNow));
    }
}