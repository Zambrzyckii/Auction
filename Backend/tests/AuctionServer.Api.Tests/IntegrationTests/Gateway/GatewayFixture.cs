using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Configurations;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Networks;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

public sealed class GatewayFixture : IAsyncLifetime
{
    private readonly INetwork _network;
    private readonly IContainer _upstream;
    private readonly IContainer _gateway;

    public GatewayFixture()
    {
        _network = new NetworkBuilder().Build();

        _upstream = new ContainerBuilder("traefik/whoami:v1.12.0")
            .WithNetwork(_network)
            .WithNetworkAliases("api")
            .WithCommand("-port", "8080")
            .Build();

        _gateway = new ContainerBuilder("nginx:1.28.3-alpine")
            .WithNetwork(_network)
            .WithResourceMapping(
                File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "gateway", "nginx.conf")),
                "/etc/nginx/nginx.conf")
            .WithPortBinding(80, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(
                request => request.ForPath("/gateway-health").ForPort(80),
                strategy => strategy.WithMode(WaitStrategyMode.Running).WithTimeout(TimeSpan.FromSeconds(30))))
            .Build();
    }

    public HttpClient CreateClient()
    {
        return new HttpClient { BaseAddress = new Uri($"http://{_gateway.Hostname}:{_gateway.GetMappedPublicPort(80)}") };
    }

    public async Task InitializeAsync()
    {
        await _network.CreateAsync();
        await _upstream.StartAsync();
        await _gateway.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _gateway.DisposeAsync();
        await _upstream.DisposeAsync();
        await _network.DisposeAsync();
    }
}
