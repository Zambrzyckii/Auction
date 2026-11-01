using Testcontainers.Redis;

namespace AuctionServer.Api.Tests.IntegrationTests.Caching;

public sealed class RedisFixture : IAsyncLifetime
{
    private readonly RedisContainer _redis = new RedisBuilder("redis:7.2-alpine").Build();

    public string ConnectionString => _redis.GetConnectionString();

    public Task InitializeAsync() => _redis.StartAsync();

    public Task DisposeAsync() => _redis.DisposeAsync().AsTask();
}
