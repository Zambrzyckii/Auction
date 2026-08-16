using FluentValidation;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public sealed class PlaceBidCommandValidator : AbstractValidator<PlaceBidCommand>
{
    public PlaceBidCommandValidator()
    {
        RuleFor(x => x.PublicAuctionId).NotEmpty();
        RuleFor(x => x.BidderId).NotEmpty();
        RuleFor(x => x.NewPrice).GreaterThan(0);
    }
}