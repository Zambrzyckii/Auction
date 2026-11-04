namespace AuctionServer.Api.Infrastructure.RateLimiting;

public sealed class RateLimitPolicyOptions
{
    public int TokenLimit { get; init; }
    public int TokensPerPeriod { get; init; }
    public int PeriodSeconds { get; init; }
}

public sealed class RateLimitingOptions
{
    public bool Enabled { get; init; }
    public RateLimitPolicyOptions? Writes { get; init; }
    public RateLimitPolicyOptions? HotWrites { get; init; }
    public RateLimitPolicyOptions? Uploads { get; init; }

    public static RateLimitingOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("RateLimiting").Get<RateLimitingOptions>() ?? new RateLimitingOptions();

        if (!options.Enabled) return options;

        Validate(options.Writes, "Writes");
        Validate(options.HotWrites, "HotWrites");
        Validate(options.Uploads, "Uploads");

        return options;
    }

    private static void Validate(RateLimitPolicyOptions? policy, string name)
    {
        if (policy is null)
            throw new InvalidOperationException(
                $"RateLimiting:{name} must be present when RateLimiting is enabled");
        if (policy.TokenLimit < 1)
            throw new InvalidOperationException(
                $"RateLimiting:{name}:TokenLimit must be at least 1, got {policy.TokenLimit}");
        if (policy.TokensPerPeriod < 1)
            throw new InvalidOperationException(
                $"RateLimiting:{name}:TokensPerPeriod must be at least 1, got {policy.TokensPerPeriod}");
        if (policy.PeriodSeconds is < 1 or > 3600)
            throw new InvalidOperationException(
                $"RateLimiting:{name}:PeriodSeconds must be within [1, 3600], got {policy.PeriodSeconds}");
    }
}
