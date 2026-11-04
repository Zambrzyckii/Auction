using AuctionServer.Api.Infrastructure.RateLimiting;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.RateLimiting;

public class RateLimitingOptionsTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"RateLimiting:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    private static (string Key, string Value)[] ValidPairs(params (string Key, string Value)[] overrides)
    {
        var pairs = new Dictionary<string, string>
        {
            ["Enabled"] = "true",
            ["Writes:TokenLimit"] = "40",
            ["Writes:TokensPerPeriod"] = "20",
            ["Writes:PeriodSeconds"] = "1",
            ["HotWrites:TokenLimit"] = "10",
            ["HotWrites:TokensPerPeriod"] = "5",
            ["HotWrites:PeriodSeconds"] = "1",
            ["Uploads:TokenLimit"] = "3",
            ["Uploads:TokensPerPeriod"] = "1",
            ["Uploads:PeriodSeconds"] = "10"
        };
        foreach (var (key, value) in overrides) pairs[key] = value;
        return pairs.Select(p => (p.Key, p.Value)).ToArray();
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldDefaultToDisabled()
    {
        var options = RateLimitingOptions.Load(new ConfigurationBuilder().Build());

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WhenDisabled_ShouldSkipValidation()
    {
        var options = RateLimitingOptions.Load(BuildConfiguration(
            ("Enabled", "false"), ("Writes:TokenLimit", "-5")));

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WithValidSection_ShouldBindAllPolicies()
    {
        var options = RateLimitingOptions.Load(BuildConfiguration(ValidPairs()));

        Assert.True(options.Enabled);
        Assert.Equal(20, options.Writes!.TokensPerPeriod);
        Assert.Equal(5, options.HotWrites!.TokensPerPeriod);
        Assert.Equal(10, options.Uploads!.PeriodSeconds);
    }

    [Theory]
    [InlineData("Writes")]
    [InlineData("HotWrites")]
    [InlineData("Uploads")]
    public void Load_WhenPolicySectionIsMissing_ShouldThrowNamingIt(string missing)
    {
        var pairs = ValidPairs().Where(p => !p.Key.StartsWith($"{missing}:")).ToArray();

        var exception = Assert.Throws<InvalidOperationException>(
            () => RateLimitingOptions.Load(BuildConfiguration(pairs)));

        Assert.Contains($"RateLimiting:{missing}", exception.Message);
    }

    [Theory]
    [InlineData("Writes:TokenLimit", "0", "TokenLimit")]
    [InlineData("HotWrites:TokensPerPeriod", "0", "TokensPerPeriod")]
    [InlineData("Uploads:PeriodSeconds", "0", "PeriodSeconds")]
    [InlineData("Uploads:PeriodSeconds", "3601", "PeriodSeconds")]
    public void Load_WithValueOutOfRange_ShouldThrowNamingTheKey(string key, string value, string expected)
    {
        var exception = Assert.Throws<InvalidOperationException>(
            () => RateLimitingOptions.Load(BuildConfiguration(ValidPairs((key, value)))));

        Assert.Contains(expected, exception.Message);
    }
}
