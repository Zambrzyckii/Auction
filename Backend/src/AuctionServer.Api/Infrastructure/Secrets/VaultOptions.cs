namespace AuctionServer.Api.Infrastructure.Secrets;

public sealed class VaultOptions
{
    public bool Enabled { get; init; }
    public string Address { get; init; } = string.Empty;
    public string RoleIdFile { get; init; } = string.Empty;
    public string SecretIdFile { get; init; } = string.Empty;
    public string MountPath { get; init; } = "secret";
    public string SecretPath { get; init; } = string.Empty;
    public int TimeoutSeconds { get; init; } = 5;

    public static VaultOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("Vault").Get<VaultOptions>() ?? new VaultOptions();

        if (!options.Enabled) return options;

        if (!Uri.TryCreate(options.Address, UriKind.Absolute, out var address)
            || address.Scheme is not ("http" or "https"))
            throw new InvalidOperationException(
                $"Vault:Address must be an absolute http or https url when Vault is enabled, got '{options.Address}'");
        if (string.IsNullOrWhiteSpace(options.RoleIdFile))
            throw new InvalidOperationException("Vault:RoleIdFile must not be empty when Vault is enabled");
        if (string.IsNullOrWhiteSpace(options.SecretIdFile))
            throw new InvalidOperationException("Vault:SecretIdFile must not be empty when Vault is enabled");
        if (string.IsNullOrWhiteSpace(options.MountPath))
            throw new InvalidOperationException("Vault:MountPath must not be empty when Vault is enabled");
        if (string.IsNullOrWhiteSpace(options.SecretPath))
            throw new InvalidOperationException("Vault:SecretPath must not be empty when Vault is enabled");
        if (options.TimeoutSeconds is < 1 or > 300)
            throw new InvalidOperationException(
                $"Vault:TimeoutSeconds must be within [1, 300], got {options.TimeoutSeconds}");

        return options;
    }
}
