using AuctionServer.Modules.Pawnshop.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Queries.GetOffers;

public class GetOffersQueryHandler(PawnshopOptions options) : IRequestHandler<GetOffersQuery, PawnshopOffersDto>
{
    public Task<PawnshopOffersDto> Handle(GetOffersQuery request, CancellationToken token)
    {
        var tiers = options.BotTiers
            .Select(t => new BotTierDto(t.Name, t.Rarity, t.Price, t.SpawnInterval, t.PayoutRate))
            .ToList();
        return Task.FromResult(new PawnshopOffersDto(
            options.PremisesPrice, options.PremisesRequiredTurnover, options.StockSellDelay, tiers));
    }
}
