using FluentValidation;

namespace AuctionServer.Modules.Banking.Application.Command.CreateLoan;

public sealed class CreateLoanCommandValidator : AbstractValidator<CreateLoanCommand>
{
    public CreateLoanCommandValidator()
    {
        RuleFor(x => x.OfferName).NotEmpty().MaximumLength(64);
    }
}
