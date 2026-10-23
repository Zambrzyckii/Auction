using AuctionServer.Api.Infrastructure.Gateway;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.Gateway;

public class GatewayOptionsTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"Gateway:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldReturnDisabledDefaults()
    {
        var options = GatewayOptions.Load(new ConfigurationBuilder().Build());

        Assert.False(options.Enabled);
        Assert.Empty(options.TrustedNetworks);
    }

    [Fact]
    public void Load_WhenDisabled_ShouldSkipValidation()
    {
        var configuration = BuildConfiguration(("Enabled", "false"), ("TrustedNetworks:0", "not a network"));

        var options = GatewayOptions.Load(configuration);

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WhenEnabledAndValid_ShouldReturnOptions()
    {
        var configuration = BuildConfiguration(
            ("Enabled", "true"),
            ("TrustedNetworks:0", "172.20.0.0/16"),
            ("TrustedNetworks:1", "10.0.0.0/8"));

        var options = GatewayOptions.Load(configuration);

        Assert.True(options.Enabled);
        Assert.Equal(["172.20.0.0/16", "10.0.0.0/8"], options.TrustedNetworks);
    }

    [Fact]
    public void Load_WhenEnabledWithoutNetworks_ShouldThrow()
    {
        var configuration = BuildConfiguration(("Enabled", "true"));

        var exception = Assert.Throws<InvalidOperationException>(() => GatewayOptions.Load(configuration));

        Assert.Contains("TrustedNetworks", exception.Message);
    }

    [Theory]
    [InlineData("not a network")]
    [InlineData("172.20.0.0")]
    [InlineData("172.20.0.1/16")]
    [InlineData("172.20.0.0/33")]
    [InlineData(" ")]
    public void Load_WhenEnabledWithBadNetwork_ShouldThrow(string network)
    {
        var configuration = BuildConfiguration(("Enabled", "true"), ("TrustedNetworks:0", network));

        var exception = Assert.Throws<InvalidOperationException>(() => GatewayOptions.Load(configuration));

        Assert.Contains("TrustedNetworks", exception.Message);
    }
}
