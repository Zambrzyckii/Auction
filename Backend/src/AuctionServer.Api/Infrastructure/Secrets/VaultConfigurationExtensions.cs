namespace AuctionServer.Api.Infrastructure.Secrets;

public static class VaultConfigurationExtensions
{
    public static VaultOptions AddVaultConfiguration(this ConfigurationManager configuration)
    {
        var options = VaultOptions.Load(configuration);

        if (!options.Enabled) return options;

        configuration.Sources.Add(new VaultConfigurationSource { Options = options });
        return options;
    }
}
