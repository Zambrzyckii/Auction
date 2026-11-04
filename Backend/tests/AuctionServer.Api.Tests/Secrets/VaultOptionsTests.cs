using AuctionServer.Api.Infrastructure.Secrets;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.Secrets;

public class VaultOptionsTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"Vault:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    private static (string Key, string Value)[] ValidPairs(params (string Key, string Value)[] overrides)
    {
        var pairs = new Dictionary<string, string>
        {
            ["Enabled"] = "true",
            ["Address"] = "http://vault:8200",
            ["RoleIdFile"] = "/vault/credentials/role-id",
            ["SecretIdFile"] = "/vault/credentials/secret-id",
            ["SecretPath"] = "auction/api"
        };
        foreach (var (key, value) in overrides) pairs[key] = value;
        return pairs.Select(p => (p.Key, p.Value)).ToArray();
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldDefaultToDisabled()
    {
        var options = VaultOptions.Load(new ConfigurationBuilder().Build());

        Assert.False(options.Enabled);
        Assert.Equal("secret", options.MountPath);
        Assert.Equal(5, options.TimeoutSeconds);
    }

    [Fact]
    public void Load_WhenDisabled_ShouldSkipValidation()
    {
        var configuration = BuildConfiguration(("Enabled", "false"), ("Address", "not-a-url"));

        var options = VaultOptions.Load(configuration);

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WhenEnabledAndValid_ShouldReturnOptions()
    {
        var configuration = BuildConfiguration(ValidPairs());

        var options = VaultOptions.Load(configuration);

        Assert.True(options.Enabled);
        Assert.Equal("http://vault:8200", options.Address);
        Assert.Equal("/vault/credentials/role-id", options.RoleIdFile);
        Assert.Equal("/vault/credentials/secret-id", options.SecretIdFile);
        Assert.Equal("secret", options.MountPath);
        Assert.Equal("auction/api", options.SecretPath);
        Assert.Equal(5, options.TimeoutSeconds);
    }

    [Theory]
    [InlineData(" ")]
    [InlineData("not-a-url")]
    [InlineData("ftp://vault:8200")]
    [InlineData("vault:8200")]
    public void Load_WhenAddressIsInvalid_ShouldThrow(string address)
    {
        var configuration = BuildConfiguration(ValidPairs(("Address", address)));

        var exception = Assert.Throws<InvalidOperationException>(() => VaultOptions.Load(configuration));

        Assert.Contains("Vault:Address", exception.Message);
    }

    [Fact]
    public void Load_WhenRoleIdFileIsEmpty_ShouldThrow()
    {
        var configuration = BuildConfiguration(ValidPairs(("RoleIdFile", " ")));

        var exception = Assert.Throws<InvalidOperationException>(() => VaultOptions.Load(configuration));

        Assert.Contains("Vault:RoleIdFile", exception.Message);
    }

    [Fact]
    public void Load_WhenSecretIdFileIsEmpty_ShouldThrow()
    {
        var configuration = BuildConfiguration(ValidPairs(("SecretIdFile", " ")));

        var exception = Assert.Throws<InvalidOperationException>(() => VaultOptions.Load(configuration));

        Assert.Contains("Vault:SecretIdFile", exception.Message);
    }

    [Fact]
    public void Load_WhenMountPathIsBlank_ShouldThrow()
    {
        var configuration = BuildConfiguration(ValidPairs(("MountPath", " ")));

        var exception = Assert.Throws<InvalidOperationException>(() => VaultOptions.Load(configuration));

        Assert.Contains("Vault:MountPath", exception.Message);
    }

    [Fact]
    public void Load_WhenSecretPathIsMissing_ShouldThrow()
    {
        var configuration = BuildConfiguration(ValidPairs(("SecretPath", " ")));

        var exception = Assert.Throws<InvalidOperationException>(() => VaultOptions.Load(configuration));

        Assert.Contains("Vault:SecretPath", exception.Message);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("301")]
    public void Load_WhenTimeoutIsOutOfRange_ShouldThrow(string timeout)
    {
        var configuration = BuildConfiguration(ValidPairs(("TimeoutSeconds", timeout)));

        var exception = Assert.Throws<InvalidOperationException>(() => VaultOptions.Load(configuration));

        Assert.Contains("Vault:TimeoutSeconds", exception.Message);
    }
}
