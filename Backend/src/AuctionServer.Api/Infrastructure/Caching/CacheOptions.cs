namespace AuctionServer.Api.Infrastructure.Caching;

public sealed class CacheOptions
{
    public bool Enabled { get; init; }
    public CacheRedisOptions? Redis { get; init; }

    public static CacheOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("Cache").Get<CacheOptions>() ?? new CacheOptions();

        if (!options.Enabled) return options;

        if (options.Redis is not null && string.IsNullOrWhiteSpace(options.Redis.ConnectionString))
            throw new InvalidOperationException(
                "Cache:Redis:ConnectionString must not be empty when the Cache:Redis section is present");

        return options;
    }
}

public sealed class CacheRedisOptions
{
    public string ConnectionString { get; init; } = string.Empty;
}
