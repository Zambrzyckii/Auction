using Microsoft.AspNetCore.HttpOverrides;

namespace AuctionServer.Api.Infrastructure.Gateway;

public static class GatewayExtensions
{
    public static WebApplicationBuilder AddGateway(this WebApplicationBuilder builder)
    {
        var options = GatewayOptions.Load(builder.Configuration);

        if (!options.Enabled) return builder;

        builder.Services.Configure<ForwardedHeadersOptions>(forwarded =>
        {
            forwarded.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            forwarded.KnownIPNetworks.Clear();
            forwarded.KnownProxies.Clear();
            foreach (var network in options.TrustedNetworks)
                forwarded.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
        });

        return builder;
    }
}
