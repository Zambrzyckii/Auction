using System.Net;
using System.Text.RegularExpressions;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Configurations;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Networks;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

public class GatewayFixture : IAsyncLifetime
{
    private const string GatewayAlias = "gateway";

    private readonly INetwork _network;
    private readonly IContainer _upstream;
    private readonly IContainer _gateway;

    public GatewayFixture() : this(new NetworkBuilder())
    {
    }

    protected GatewayFixture(NetworkBuilder networkBuilder)
    {
        _network = networkBuilder.Build();

        _upstream = new ContainerBuilder("traefik/whoami:v1.12.0")
            .WithNetwork(_network)
            .WithNetworkAliases("api")
            .WithCommand("-port", "8080")
            .Build();

        _gateway = new ContainerBuilder("nginx:1.28.3-alpine")
            .WithNetwork(_network)
            .WithNetworkAliases(GatewayAlias)
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

    public async Task<HttpStatusCode> GetFromNetworkAddressAsync(string path)
    {
        var result = await _gateway.ExecAsync(["wget", "-S", "-O", "/dev/null", $"http://{GatewayAlias}{path}"]);
        var statusLine = Regex.Match(result.Stderr, @"HTTP/1\.1 (\d{3})");

        if (!statusLine.Success)
            throw new InvalidOperationException($"wget got no HTTP response: {result.Stderr}");

        return (HttpStatusCode)int.Parse(statusLine.Groups[1].Value);
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
