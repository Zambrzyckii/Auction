using AuctionServer.Api.Infrastructure.Secrets;

namespace AuctionServer.Api.Tests.IntegrationTests.Secrets;

[Collection(OpenBaoCollection.Name)]
public sealed class OpenBaoContractTests(OpenBaoFixture fixture) : IDisposable
{
    private readonly string _directory = Directory.CreateTempSubdirectory("openbao-contract-tests-").FullName;

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    private VaultOptions BuildOptions(string secretPath, string? secretId = null)
    {
        var roleIdFile = Path.Combine(_directory, "role-id");
        var secretIdFile = Path.Combine(_directory, "secret-id");
        File.WriteAllText(roleIdFile, fixture.RoleId);
        File.WriteAllText(secretIdFile, secretId ?? fixture.SecretId);
        return new VaultOptions
        {
            Enabled = true,
            Address = fixture.Address,
            RoleIdFile = roleIdFile,
            SecretIdFile = secretIdFile,
            SecretPath = secretPath
        };
    }

    [Fact]
    public void Load_ShouldLoginWithAppRoleAndExposeSeededSecrets()
    {
        var provider = new VaultConfigurationProvider(BuildOptions("auction/api"));

        provider.Load();

        Assert.True(provider.TryGet("Jwt:Key", out var jwtKey));
        Assert.Equal("from-openbao", jwtKey);
        Assert.True(provider.TryGet("Bots:ApiKey", out var apiKey));
        Assert.Equal("bao-bot-key", apiKey);
    }

    [Fact]
    public void Load_WhenPolicyDoesNotCoverThePath_ShouldThrow()
    {
        var provider = new VaultConfigurationProvider(BuildOptions("outside/forbidden"));

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("policy", exception.Message);
        Assert.Contains("secret/data/outside/forbidden", exception.Message);
    }

    [Fact]
    public void Load_WhenSecretIsMissing_ShouldThrow()
    {
        var provider = new VaultConfigurationProvider(BuildOptions("auction/missing"));

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("has no secret at 'secret/data/auction/missing'", exception.Message);
    }

    [Fact]
    public void Load_WhenSecretIdIsWrong_ShouldThrow()
    {
        var provider = new VaultConfigurationProvider(
            BuildOptions("auction/api", secretId: Guid.NewGuid().ToString()));

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("AppRole login", exception.Message);
        Assert.Contains("status 400", exception.Message);
    }
}
