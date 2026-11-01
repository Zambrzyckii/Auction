using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionById;

public record GetAuctionByIdQuery(Guid PublicAuctionId) : IRequest<AuctionByIdQueryDto>, ICachedQuery
{
    public string CacheKey => $"auctions:detail:v1:{PublicAuctionId}";

    public TimeSpan GetTtl(AuctionReadCacheOptions options) => options.DetailTtl;
}
