namespace AuctionServer.Api.Infrastructure.Gateway;

public sealed class GatewayOptions
{
    public bool Enabled { get; init; }
    public List<string> TrustedNetworks { get; init; } = [];

    public static GatewayOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("Gateway").Get<GatewayOptions>() ?? new GatewayOptions();

        if (!options.Enabled) return options;

        if (options.TrustedNetworks.Count == 0)
            throw new InvalidOperationException("Gateway:TrustedNetworks must not be empty when the gateway is enabled");

        foreach (var net in options.TrustedNetworks)
        {
            if (!System.Net.IPNetwork.TryParse(net, out var network))
                throw new InvalidOperationException($"Gateway:TrustedNetworks entry '{net}' is not a valid CIDR network");
            if (network.ToString() != net)
                throw new InvalidOperationException($"Gateway:TrustedNetworks entry '{net}' should be written as '{network}'");
        }

        return options;
    }
}
