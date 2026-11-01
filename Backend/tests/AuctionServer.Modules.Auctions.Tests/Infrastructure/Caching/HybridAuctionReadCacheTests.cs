using System.Diagnostics.Metrics;
using AuctionServer.Modules.Auctions.Infrastructure.Caching;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Auctions.Tests.Infrastructure.Caching;

public class HybridAuctionReadCacheTests : IDisposable
{
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(2);
    private readonly ServiceProvider _provider;
    private readonly HybridAuctionReadCache _cache;
    private readonly CapturingLogger _logger = new();
    private readonly AuctionCacheMetrics _metrics = new(new TestMeterFactory());

    public HybridAuctionReadCacheTests()
    {
        var services = new ServiceCollection();
        services.AddHybridCache();
        _provider = services.BuildServiceProvider();
        _cache = new HybridAuctionReadCache(_provider.GetRequiredService<HybridCache>(), _metrics, _logger);
    }

    public void Dispose() => _provider.Dispose();

    [Fact]
    public async Task GetOrCreateAsync_OnMiss_ShouldReturnFactoryResult()
    {
        var result = await _cache.GetOrCreateAsync("auctions:detail:v1:miss", _ => Task.FromResult(7), Ttl,
            CancellationToken.None);

        Assert.Equal(7, result);
    }

    [Fact]
    public async Task GetOrCreateAsync_WithinTtl_ShouldServeSecondCallFromCache()
    {
        var calls = 0;
        Func<CancellationToken, Task<int>> factory = _ => Task.FromResult(++calls);

        var first = await _cache.GetOrCreateAsync("auctions:detail:v1:hit", factory, Ttl, CancellationToken.None);
        var second = await _cache.GetOrCreateAsync("auctions:detail:v1:hit", factory, Ttl, CancellationToken.None);

        Assert.Equal(1, calls);
        Assert.Equal(first, second);
    }

    [Fact]
    public async Task GetOrCreateAsync_WithDifferentKeys_ShouldInvokeFactoryPerKey()
    {
        var calls = 0;
        Func<CancellationToken, Task<int>> factory = _ => Task.FromResult(++calls);

        await _cache.GetOrCreateAsync("auctions:detail:v1:a", factory, Ttl, CancellationToken.None);
        await _cache.GetOrCreateAsync("auctions:detail:v1:b", factory, Ttl, CancellationToken.None);

        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task GetOrCreateAsync_AfterTtl_ShouldInvokeFactoryAgain()
    {
        var calls = 0;
        Func<CancellationToken, Task<int>> factory = _ => Task.FromResult(++calls);
        var ttl = TimeSpan.FromMilliseconds(50);

        await _cache.GetOrCreateAsync("auctions:detail:v1:expiry", factory, ttl, CancellationToken.None);
        await Task.Delay(500);
        await _cache.GetOrCreateAsync("auctions:detail:v1:expiry", factory, ttl, CancellationToken.None);

        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenFactoryThrows_ShouldPropagateAndInvokeFactoryOnce()
    {
        var calls = 0;
        Func<CancellationToken, Task<int>> factory = _ =>
        {
            calls++;
            throw new InvalidOperationException("auction not found");
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _cache.GetOrCreateAsync("auctions:detail:v1:throwing", factory, Ttl, CancellationToken.None));

        Assert.Equal(1, calls);
        Assert.Empty(_logger.Entries);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenFactoryThrows_ShouldNotCacheTheFailure()
    {
        Func<CancellationToken, Task<int>> throwing = _ => throw new InvalidOperationException("auction not found");

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _cache.GetOrCreateAsync("auctions:detail:v1:recovery", throwing, Ttl, CancellationToken.None));
        var recovered = await _cache.GetOrCreateAsync("auctions:detail:v1:recovery", _ => Task.FromResult(9), Ttl,
            CancellationToken.None);

        Assert.Equal(9, recovered);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenCacheFails_ShouldFallBackToFactoryAndLog()
    {
        var cache = new HybridAuctionReadCache(new ThrowingHybridCache(), _metrics, _logger);

        var result = await cache.GetOrCreateAsync("auctions:detail:v1:down", _ => Task.FromResult(5), Ttl,
            CancellationToken.None);

        Assert.Equal(5, result);
        Assert.NotEmpty(_logger.Entries);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenCancelled_ShouldThrowWithoutFallingBack()
    {
        var cache = new HybridAuctionReadCache(new ThrowingHybridCache(), _metrics, _logger);
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        var calls = 0;

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            cache.GetOrCreateAsync("auctions:detail:v1:cancelled", _ => Task.FromResult(++calls), Ttl, cts.Token));

        Assert.Equal(0, calls);
    }

    [Fact]
    public async Task GetOrCreateAsync_ShouldCountMissThenHit()
    {
        using var capture = new MetricCapture();

        await _cache.GetOrCreateAsync("auctions:detail:v1:metrics", _ => Task.FromResult(1), Ttl,
            CancellationToken.None);
        await _cache.GetOrCreateAsync("auctions:detail:v1:metrics", _ => Task.FromResult(2), Ttl,
            CancellationToken.None);

        Assert.Equal(1, capture.Count("auctions.cache.misses"));
        Assert.Equal(1, capture.Count("auctions.cache.hits"));
        Assert.Equal(0, capture.Count("auctions.cache.errors"));
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenCacheFails_ShouldCountError()
    {
        using var capture = new MetricCapture();
        var cache = new HybridAuctionReadCache(new ThrowingHybridCache(), _metrics, _logger);

        await cache.GetOrCreateAsync("auctions:detail:v1:error-metric", _ => Task.FromResult(5), Ttl,
            CancellationToken.None);

        Assert.Equal(1, capture.Count("auctions.cache.errors"));
        Assert.Equal(0, capture.Count("auctions.cache.hits"));
    }

    private sealed class TestMeterFactory : IMeterFactory
    {
        public Meter Create(MeterOptions options) => new(options);

        public void Dispose()
        {
        }
    }

    private sealed class MetricCapture : IDisposable
    {
        private readonly MeterListener _listener = new();
        private readonly Dictionary<string, long> _counts = [];

        public MetricCapture()
        {
            _listener.InstrumentPublished = (instrument, listener) =>
            {
                if (instrument.Meter.Name == AuctionCacheMetrics.MeterName)
                    listener.EnableMeasurementEvents(instrument);
            };
            _listener.SetMeasurementEventCallback<long>((instrument, measurement, _, _) =>
            {
                lock (_counts)
                    _counts[instrument.Name] = _counts.GetValueOrDefault(instrument.Name) + measurement;
            });
            _listener.Start();
        }

        public long Count(string name)
        {
            lock (_counts)
                return _counts.GetValueOrDefault(name);
        }

        public void Dispose() => _listener.Dispose();
    }

    private sealed class ThrowingHybridCache : HybridCache
    {
        public override ValueTask<T> GetOrCreateAsync<TState, T>(string key, TState state,
            Func<TState, CancellationToken, ValueTask<T>> factory, HybridCacheEntryOptions? options = null,
            IEnumerable<string>? tags = null, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new InvalidOperationException("cache down");
        }

        public override ValueTask SetAsync<T>(string key, T value, HybridCacheEntryOptions? options = null,
            IEnumerable<string>? tags = null, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("cache down");

        public override ValueTask RemoveAsync(string key, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("cache down");

        public override ValueTask RemoveByTagAsync(string tag, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("cache down");
    }

    private sealed class CapturingLogger : ILogger<HybridAuctionReadCache>
    {
        public List<LogLevel> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Entries.Add(logLevel);
    }
}
