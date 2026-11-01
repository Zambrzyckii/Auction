using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionBids;

public record GetAuctionBidsQuery(Guid PublicAuctionId) : IRequest<List<AuctionBidQueryDto>>, ICachedQuery
{
    public string CacheKey => $"auctions:bids:v1:{PublicAuctionId}";

    public TimeSpan GetTtl(AuctionReadCacheOptions options) => options.BidsTtl;
}
