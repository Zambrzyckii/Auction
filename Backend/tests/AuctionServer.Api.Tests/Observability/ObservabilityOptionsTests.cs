using AuctionServer.Api.Infrastructure.Observability;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.Observability;

public class ObservabilityOptionsTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"Observability:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldReturnDisabledDefaults()
    {
        var options = ObservabilityOptions.Load(new ConfigurationBuilder().Build());

        Assert.False(options.Enabled);
        Assert.Equal("auction-server", options.ServiceName);
        Assert.Equal(1.0, options.TraceSampleRatio);
        Assert.Equal(10, options.MetricExportIntervalSeconds);
    }

    [Fact]
    public void Load_WhenDisabled_ShouldSkipValidation()
    {
        var configuration = BuildConfiguration(("Enabled", "false"), ("OtlpEndpoint", "not a url"));

        var options = ObservabilityOptions.Load(configuration);

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WhenEnabledAndValid_ShouldReturnOptions()
    {
        var configuration = BuildConfiguration(
            ("Enabled", "true"),
            ("OtlpEndpoint", "http://dashboard:18889"),
            ("TraceSampleRatio", "0.5"),
            ("MetricExportIntervalSeconds", "5"));

        var options = ObservabilityOptions.Load(configuration);

        Assert.True(options.Enabled);
        Assert.Equal("http://dashboard:18889", options.OtlpEndpoint);
        Assert.Equal(0.5, options.TraceSampleRatio);
        Assert.Equal(5, options.MetricExportIntervalSeconds);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("dashboard:18889")]
    [InlineData("ftp://dashboard:18889")]
    [InlineData("/relative/path")]
    public void Load_WhenEnabledWithBadEndpoint_ShouldThrow(string? endpoint)
    {
        var pairs = new List<(string, string)> { ("Enabled", "true") };
        if (endpoint is not null) pairs.Add(("OtlpEndpoint", endpoint));
        var configuration = BuildConfiguration(pairs.ToArray());

        var exception = Assert.Throws<InvalidOperationException>(() => ObservabilityOptions.Load(configuration));

        Assert.Contains("OtlpEndpoint", exception.Message);
    }

    [Theory]
    [InlineData("-0.1")]
    [InlineData("1.1")]
    public void Load_WhenSampleRatioIsOutOfRange_ShouldThrow(string ratio)
    {
        var configuration = BuildConfiguration(
            ("Enabled", "true"), ("OtlpEndpoint", "http://dashboard:18889"), ("TraceSampleRatio", ratio));

        var exception = Assert.Throws<InvalidOperationException>(() => ObservabilityOptions.Load(configuration));

        Assert.Contains("TraceSampleRatio", exception.Message);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("61")]
    public void Load_WhenExportIntervalIsOutOfRange_ShouldThrow(string interval)
    {
        var configuration = BuildConfiguration(
            ("Enabled", "true"), ("OtlpEndpoint", "http://dashboard:18889"), ("MetricExportIntervalSeconds", interval));

        var exception = Assert.Throws<InvalidOperationException>(() => ObservabilityOptions.Load(configuration));

        Assert.Contains("MetricExportIntervalSeconds", exception.Message);
    }

    [Fact]
    public void Load_WhenEnabledWithBlankServiceName_ShouldThrow()
    {
        var configuration = BuildConfiguration(
            ("Enabled", "true"), ("OtlpEndpoint", "http://dashboard:18889"), ("ServiceName", " "));

        var exception = Assert.Throws<InvalidOperationException>(() => ObservabilityOptions.Load(configuration));

        Assert.Contains("ServiceName", exception.Message);
    }
}
