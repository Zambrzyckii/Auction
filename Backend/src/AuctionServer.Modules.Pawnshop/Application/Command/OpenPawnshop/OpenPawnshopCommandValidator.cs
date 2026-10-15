using FluentValidation;

namespace AuctionServer.Modules.Pawnshop.Application.Command.OpenPawnshop;

public sealed class OpenPawnshopCommandValidator : AbstractValidator<OpenPawnshopCommand>
{
    public OpenPawnshopCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
    }
}
