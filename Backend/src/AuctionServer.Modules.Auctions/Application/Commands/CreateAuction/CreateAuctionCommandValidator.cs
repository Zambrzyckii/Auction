using FluentValidation;

namespace AuctionServer.Modules.Auctions.Application.Commands.CreateAuction;

public sealed class CreateAuctionCommandValidator : AbstractValidator<CreateAuctionCommand>
{
    public CreateAuctionCommandValidator()
    {
        RuleFor(x => x.SellerId).NotEmpty();
        RuleFor(x => x.ItemId).NotEmpty();
        RuleFor(x => x.StartingPrice).GreaterThan(0);
        RuleFor(x => x.EndsOn).GreaterThan(_ => DateTimeOffset.UtcNow).LessThan(_ => DateTimeOffset.UtcNow.AddDays(30));
    }
}