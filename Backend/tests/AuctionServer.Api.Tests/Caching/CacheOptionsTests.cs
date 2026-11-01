using AuctionServer.Api.Infrastructure.Caching;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.Caching;

public class CacheOptionsTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"Cache:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldReturnDisabledDefaults()
    {
        var options = CacheOptions.Load(new ConfigurationBuilder().Build());

        Assert.False(options.Enabled);
        Assert.Null(options.Redis);
    }

    [Fact]
    public void Load_WhenEnabledWithoutRedis_ShouldReturnNoRedisOptions()
    {
        var configuration = BuildConfiguration(("Enabled", "true"));

        var options = CacheOptions.Load(configuration);

        Assert.True(options.Enabled);
        Assert.Null(options.Redis);
    }

    [Fact]
    public void Load_WhenEnabledWithRedis_ShouldReturnConnectionString()
    {
        var configuration = BuildConfiguration(("Enabled", "true"), ("Redis:ConnectionString", "redis:6379"));

        var options = CacheOptions.Load(configuration);

        Assert.True(options.Enabled);
        Assert.NotNull(options.Redis);
        Assert.Equal("redis:6379", options.Redis.ConnectionString);
    }

    [Fact]
    public void Load_WhenRedisConnectionStringIsEmpty_ShouldThrow()
    {
        var configuration = BuildConfiguration(("Enabled", "true"), ("Redis:ConnectionString", " "));

        var exception = Assert.Throws<InvalidOperationException>(() => CacheOptions.Load(configuration));

        Assert.Contains("Cache:Redis:ConnectionString", exception.Message);
    }

    [Fact]
    public void Load_WhenDisabled_ShouldSkipValidation()
    {
        var configuration = BuildConfiguration(("Enabled", "false"), ("Redis:ConnectionString", " "));

        var options = CacheOptions.Load(configuration);

        Assert.False(options.Enabled);
    }
}
