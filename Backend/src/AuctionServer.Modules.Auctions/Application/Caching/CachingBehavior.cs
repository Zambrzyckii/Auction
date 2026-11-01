using AuctionServer.Modules.Auctions.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Caching;

public sealed class CachingBehavior<TRequest, TResponse>(IAuctionReadCache cache, AuctionReadCacheOptions options)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : ICachedQuery
{
    public Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(request.CacheKey, ct => next(ct), request.GetTtl(options), cancellationToken);
}
