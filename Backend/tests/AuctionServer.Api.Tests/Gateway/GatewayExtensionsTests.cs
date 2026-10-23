using AuctionServer.Api.Infrastructure.Gateway;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AuctionServer.Api.Tests.Gateway;

public class GatewayExtensionsTests
{
    [Fact]
    public void AddGateway_WhenEnabled_ShouldTrustConfiguredNetworksOnly()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Configuration["Gateway:Enabled"] = "true";
        builder.Configuration["Gateway:TrustedNetworks:0"] = "172.20.0.0/16";

        builder.AddGateway();
        using var app = builder.Build();

        var forwarded = app.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        Assert.Equal(ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, forwarded.ForwardedHeaders);
        Assert.Empty(forwarded.KnownProxies);
        var network = Assert.Single(forwarded.KnownIPNetworks);
        Assert.Equal(System.Net.IPNetwork.Parse("172.20.0.0/16"), network);
    }

    [Fact]
    public void AddGateway_WhenDisabled_ShouldLeaveForwardedHeadersOff()
    {
        var builder = WebApplication.CreateBuilder();

        builder.AddGateway();
        using var app = builder.Build();

        var forwarded = app.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        Assert.Equal(ForwardedHeaders.None, forwarded.ForwardedHeaders);
    }
}
