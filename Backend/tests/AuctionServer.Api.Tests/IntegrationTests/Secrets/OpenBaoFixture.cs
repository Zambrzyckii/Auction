using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace AuctionServer.Api.Tests.IntegrationTests.Secrets;

[CollectionDefinition(OpenBaoCollection.Name)]
public sealed class OpenBaoCollection : ICollectionFixture<OpenBaoFixture>
{
    public const string Name = "OpenBao";
}

public sealed class OpenBaoFixture : IAsyncLifetime
{
    public const string Image = "openbao/openbao:2.7.2";
    private const string RootToken = "test-root-token";

    private readonly IContainer _container = new ContainerBuilder(Image)
        .WithCommand("server", "-dev", $"-dev-root-token-id={RootToken}", "-dev-listen-address=0.0.0.0:8200")
        .WithPortBinding(8200, true)
        .WithWaitStrategy(Wait.ForUnixContainer()
            .UntilHttpRequestIsSucceeded(request => request.ForPort(8200).ForPath("/v1/sys/health")))
        .Build();

    public string Address => $"http://{_container.Hostname}:{_container.GetMappedPublicPort(8200)}";
    public string RoleId { get; private set; } = string.Empty;
    public string SecretId { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        await BaoAsync("auth enable approle");
        await BaoAsync(
            """echo 'path "secret/data/auction/*" { capabilities = ["read"] }' | bao policy write auction-api -""",
            raw: true);
        await BaoAsync("write auth/approle/role/auction-api token_policies=auction-api");
        await BaoAsync("""kv put -mount=secret auction/api 'Jwt:Key=from-openbao' 'Bots:ApiKey=bao-bot-key'""");
        await BaoAsync("""kv put -mount=secret outside/forbidden 'Hidden=yes'""");

        RoleId = await BaoAsync("read -field=role_id auth/approle/role/auction-api/role-id");
        SecretId = await BaoAsync("write -f -field=secret_id auth/approle/role/auction-api/secret-id");
    }

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    private async Task<string> BaoAsync(string command, bool raw = false)
    {
        var script = raw ? command : $"bao {command}";
        var result = await _container.ExecAsync(
            ["/bin/sh", "-c", $"export BAO_ADDR=http://127.0.0.1:8200 BAO_TOKEN={RootToken}; {script}"]);

        return result.ExitCode == 0
            ? result.Stdout.Trim()
            : throw new InvalidOperationException($"OpenBao setup command '{script}' failed: {result.Stderr}");
    }
}
