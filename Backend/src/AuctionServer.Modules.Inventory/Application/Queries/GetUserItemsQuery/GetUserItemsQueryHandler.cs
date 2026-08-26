using AuctionServer.Modules.Inventory.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Queries.GetUserItemsQuery;

public sealed class GetUserItemsQueryHandler(IItemRepository repository) : IRequestHandler<GetUserItemsQuery, List<UserItemsDto>> 
{
    public async Task<List<UserItemsDto>> Handle(GetUserItemsQuery request, CancellationToken cancellationToken)
    {
        var items = await repository.GetUserItemsReadOnlyAsync(request.OwnerId, cancellationToken);

        return items
            .Select(i => new UserItemsDto(i.PublicItemId, i.Name, i.Rarity, i.Status, i.OfficialPrice))
            .ToList();
    }
}