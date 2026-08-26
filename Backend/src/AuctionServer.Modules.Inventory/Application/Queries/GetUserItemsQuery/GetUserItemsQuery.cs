using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Queries.GetUserItemsQuery;

public record GetUserItemsQuery(Guid OwnerId) : IRequest<List<UserItemsDto>>;