namespace AuctionServer.Api.Infrastructure.Secrets;

public sealed class VaultConfigurationSource : IConfigurationSource
{
    public required VaultOptions Options { get; init; }

    public IConfigurationProvider Build(IConfigurationBuilder builder) => new VaultConfigurationProvider(Options);
}
