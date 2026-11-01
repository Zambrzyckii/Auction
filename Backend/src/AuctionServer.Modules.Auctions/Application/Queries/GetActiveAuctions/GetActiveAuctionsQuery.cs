using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public record GetActiveAuctionsQuery(int Limit) : IRequest<List<ActiveAuctionQueryDto>>, ICachedQuery
{
    public string CacheKey => $"auctions:list:v1:{Limit}";

    public TimeSpan GetTtl(AuctionReadCacheOptions options) => options.ListTtl;
}
