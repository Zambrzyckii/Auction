using FluentValidation;

namespace AuctionServer.Modules.Banking.Application.Command.RepayLoan;

public sealed class RepayLoanCommandValidator : AbstractValidator<RepayLoanCommand>
{
    public RepayLoanCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.PublicLoanId).NotEmpty();
    }
}
