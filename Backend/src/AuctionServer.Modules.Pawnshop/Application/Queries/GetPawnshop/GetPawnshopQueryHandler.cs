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
        return new PawnshopDto(shop.PublicPawnshopId, shop.Status, shop.RequestedOn, shop.ActivatedOn,
            shop.RejectionReason);
    }
}
