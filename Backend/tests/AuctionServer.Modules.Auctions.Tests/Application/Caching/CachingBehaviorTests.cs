using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Options;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Auctions.Tests.Application.Caching;

public class CachingBehaviorTests
{
    private sealed record CachedPing(int Value) : IRequest<string>, ICachedQuery
    {
        public string CacheKey => $"test:ping:v1:{Value}";

        public TimeSpan GetTtl(AuctionReadCacheOptions options) => options.ListTtl;
    }

    private sealed class CachedPingHandler : IRequestHandler<CachedPing, string>
    {
        public Task<string> Handle(CachedPing request, CancellationToken cancellationToken) =>
            Task.FromResult($"pong-{request.Value}");
    }

    private sealed record PlainPing(int Value) : IRequest<string>;

    private sealed class PlainPingHandler : IRequestHandler<PlainPing, string>
    {
        public Task<string> Handle(PlainPing request, CancellationToken cancellationToken) =>
            Task.FromResult($"plain-{request.Value}");
    }

    private sealed class RecordingCache : IAuctionReadCache
    {
        public List<(string Key, TimeSpan Ttl)> Calls { get; } = [];

        public Task<T> GetOrCreateAsync<T>(string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl,
            CancellationToken cancellationToken)
        {
            Calls.Add((key, ttl));
            return factory(cancellationToken);
        }
    }

    private readonly RecordingCache _cache = new();

    private ServiceProvider BuildProvider(AuctionReadCacheOptions options)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IAuctionReadCache>(_cache);
        services.AddSingleton(options);
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(CachingBehaviorTests).Assembly));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>));
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task Send_WhenQueryIsCached_ShouldReturnHandlerResponse()
    {
        using var provider = BuildProvider(new AuctionReadCacheOptions());
        var mediator = provider.GetRequiredService<IMediator>();

        var response = await mediator.Send(new CachedPing(7), CancellationToken.None);

        Assert.Equal("pong-7", response);
    }

    [Fact]
    public async Task Send_WhenQueryIsCached_ShouldPassKeyAndTtlToCache()
    {
        var options = new AuctionReadCacheOptions { ListTtl = TimeSpan.FromSeconds(5) };
        using var provider = BuildProvider(options);
        var mediator = provider.GetRequiredService<IMediator>();

        await mediator.Send(new CachedPing(7), CancellationToken.None);

        var call = Assert.Single(_cache.Calls);
        Assert.Equal("test:ping:v1:7", call.Key);
        Assert.Equal(TimeSpan.FromSeconds(5), call.Ttl);
    }

    [Fact]
    public async Task Send_WhenQueryIsNotCached_ShouldBypassCache()
    {
        using var provider = BuildProvider(new AuctionReadCacheOptions());
        var mediator = provider.GetRequiredService<IMediator>();

        var response = await mediator.Send(new PlainPing(7), CancellationToken.None);

        Assert.Equal("plain-7", response);
        Assert.Empty(_cache.Calls);
    }
}
