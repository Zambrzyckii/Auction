using AuctionServer.Modules.Auctions.Infrastructure.Caching;

namespace AuctionServer.Modules.Auctions.Tests.Infrastructure.Caching;

public class PassThroughAuctionReadCacheTests
{
    private readonly PassThroughAuctionReadCache _cache = new();

    [Fact]
    public async Task GetOrCreateAsync_ShouldReturnFactoryResult()
    {
        var result = await _cache.GetOrCreateAsync("auctions:list:v1:10", _ => Task.FromResult(42),
            TimeSpan.FromSeconds(2), CancellationToken.None);

        Assert.Equal(42, result);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenCalledTwiceWithSameKey_ShouldInvokeFactoryEachTime()
    {
        var calls = 0;
        Func<CancellationToken, Task<int>> factory = _ => Task.FromResult(++calls);

        await _cache.GetOrCreateAsync("auctions:list:v1:10", factory, TimeSpan.FromSeconds(2), CancellationToken.None);
        var second = await _cache.GetOrCreateAsync("auctions:list:v1:10", factory, TimeSpan.FromSeconds(2), CancellationToken.None);

        Assert.Equal(2, calls);
        Assert.Equal(2, second);
    }

    [Fact]
    public async Task GetOrCreateAsync_ShouldPassCancellationTokenToFactory()
    {
        using var cts = new CancellationTokenSource();
        var received = CancellationToken.None;

        await _cache.GetOrCreateAsync("auctions:list:v1:10", ct =>
        {
            received = ct;
            return Task.FromResult(0);
        }, TimeSpan.FromSeconds(2), cts.Token);

        Assert.Equal(cts.Token, received);
    }
}
