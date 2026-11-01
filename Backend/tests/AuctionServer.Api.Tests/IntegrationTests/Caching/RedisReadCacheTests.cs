using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Caching;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using Testcontainers.Redis;

namespace AuctionServer.Api.Tests.IntegrationTests.Caching;

[Collection("RedisCache")]
public class RedisReadCacheTests(RedisFixture fixture)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(1);

    private static ServiceProvider BuildCacheProvider(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHybridCache();
        services.AddStackExchangeRedisCache(redis =>
        {
            var redisOptions = ConfigurationOptions.Parse(connectionString);
            redisOptions.AbortOnConnectFail = false;
            redisOptions.ConnectTimeout = 500;
            redisOptions.SyncTimeout = 300;
            redis.ConfigurationOptions = redisOptions;
            redis.InstanceName = "auctionserver:";
        });
        return services.BuildServiceProvider();
    }

    private static HybridAuctionReadCache CreateCache(ServiceProvider provider) =>
        new(provider.GetRequiredService<HybridCache>(),
            provider.GetRequiredService<ILogger<HybridAuctionReadCache>>());

    private static string NewKey() => $"auctions:test:v1:{Guid.NewGuid()}";

    private static async Task WaitForRedisKeyAsync(string connectionString, string key)
    {
        using var connection = await ConnectionMultiplexer.ConnectAsync(connectionString);
        var database = connection.GetDatabase();
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!await database.KeyExistsAsync($"auctionserver:{key}"))
        {
            if (DateTime.UtcNow > deadline)
                throw new TimeoutException($"Entry {key} did not reach redis within five seconds");
            await Task.Delay(50);
        }
    }

    [Fact]
    public async Task GetOrCreateAsync_WithinTtl_ShouldServeCachedValue()
    {
        await using var provider = BuildCacheProvider(fixture.ConnectionString);
        var cache = CreateCache(provider);
        var key = NewKey();
        var calls = 0;

        var first = await cache.GetOrCreateAsync(key, _ =>
        {
            calls++;
            return Task.FromResult("fresh");
        }, Ttl, CancellationToken.None);
        var second = await cache.GetOrCreateAsync(key, _ =>
        {
            calls++;
            return Task.FromResult("changed");
        }, Ttl, CancellationToken.None);

        Assert.Equal("fresh", first);
        Assert.Equal("fresh", second);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task GetOrCreateAsync_AfterTtl_ShouldInvokeFactoryAgain()
    {
        await using var provider = BuildCacheProvider(fixture.ConnectionString);
        var cache = CreateCache(provider);
        var key = NewKey();

        var first = await cache.GetOrCreateAsync(key, _ => Task.FromResult("fresh"), Ttl, CancellationToken.None);
        await Task.Delay(TimeSpan.FromMilliseconds(1500));
        var second = await cache.GetOrCreateAsync(key, _ => Task.FromResult("changed"), Ttl, CancellationToken.None);

        Assert.Equal("fresh", first);
        Assert.Equal("changed", second);
    }

    [Fact]
    public async Task GetOrCreateAsync_OnSecondHost_ShouldServeValueCachedByFirstHost()
    {
        await using var providerA = BuildCacheProvider(fixture.ConnectionString);
        await using var providerB = BuildCacheProvider(fixture.ConnectionString);
        var key = NewKey();
        var secondHostCalls = 0;

        var fromA = await CreateCache(providerA)
            .GetOrCreateAsync(key, _ => Task.FromResult("from-first-host"), TimeSpan.FromSeconds(30),
                CancellationToken.None);
        await WaitForRedisKeyAsync(fixture.ConnectionString, key);
        var fromB = await CreateCache(providerB).GetOrCreateAsync(key, _ =>
        {
            secondHostCalls++;
            return Task.FromResult("from-second-host");
        }, TimeSpan.FromSeconds(30), CancellationToken.None);

        Assert.Equal("from-first-host", fromA);
        Assert.Equal("from-first-host", fromB);
        Assert.Equal(0, secondHostCalls);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenFactoryThrows_ShouldNotCacheTheFailure()
    {
        await using var provider = BuildCacheProvider(fixture.ConnectionString);
        var cache = CreateCache(provider);
        var key = NewKey();

        await Assert.ThrowsAsync<AuctionExceptions.AuctionNotFoundException>(() =>
            cache.GetOrCreateAsync<string>(key,
                _ => throw new AuctionExceptions.AuctionNotFoundException(Guid.NewGuid()), Ttl,
                CancellationToken.None));
        var afterFailure = await cache.GetOrCreateAsync(key, _ => Task.FromResult("found"), Ttl,
            CancellationToken.None);

        Assert.Equal("found", afterFailure);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenRedisStops_ShouldFallBackToFactory()
    {
        var redis = new RedisBuilder("redis:7.2-alpine").Build();
        await redis.StartAsync();
        try
        {
            await using var provider = BuildCacheProvider(redis.GetConnectionString());
            var cache = CreateCache(provider);

            var beforeStop = await cache.GetOrCreateAsync(NewKey(), _ => Task.FromResult("warm"), Ttl,
                CancellationToken.None);
            await redis.StopAsync();
            var afterStop = await cache.GetOrCreateAsync(NewKey(), _ => Task.FromResult("from-database"), Ttl,
                CancellationToken.None);

            Assert.Equal("warm", beforeStop);
            Assert.Equal("from-database", afterStop);
        }
        finally
        {
            await redis.DisposeAsync();
        }
    }
}
