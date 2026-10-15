using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Queries.GetPawnshop;

public class GetPawnshopQueryHandler(IPawnshopRepository repository) : IRequestHandler<GetPawnshopQuery, PawnshopDto>
{
    public async Task<PawnshopDto> Handle(GetPawnshopQuery request, CancellationToken token)
    {
        var shop = await repository.GetLatestShopByUserIdReadOnlyAsync(request.UserId, token)
                   ?? throw new PawnshopExceptions.PawnshopNotFoundException();
        var stock = await repository.GetStockReadOnlyAsync(shop.PublicPawnshopId, token);
        var stockDtos = stock.Select(i => new StockItemDto(i.PublicStockItemId, i.Name, i.Rarity, i.Price,
            i.PayoutRate, i.Status, i.SpawnedOn, i.SellAfter, i.ResolvedOn, i.PayoutAmount)).ToList();
        return new PawnshopDto(shop.PublicPawnshopId, shop.Status, shop.RequestedOn, shop.ActivatedOn,
            shop.RejectionReason, shop.BotTierName, shop.BotRarity, shop.BotSpawnInterval, shop.BotPayoutRate,
            shop.BotPurchasedOn, shop.NextSpawnOn, shop.PendingBotTierName, stockDtos);
    }
}
