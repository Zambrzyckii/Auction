using System.Net;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

[Collection(GatewayCollection.Name)]
public class GatewayProxyTests(GatewayFixture gateway) : IClassFixture<GatewayFixture>
{
    private async Task<UpstreamRequest> SendThroughGatewayAsync(HttpRequestMessage request)
    {
        using var client = gateway.CreateClient();
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return UpstreamRequest.Parse(await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GatewayHealth_ShouldBeAnsweredByNginxItself()
    {
        using var client = gateway.CreateClient();

        var response = await client.GetAsync("/gateway-health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok\n", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/api/auctions?limit=5")]
    [InlineData("/health/ready")]
    public async Task RoutedPath_ShouldReachUpstreamUnchanged(string path)
    {
        var upstream = await SendThroughGatewayAsync(new HttpRequestMessage(HttpMethod.Get, path));

        Assert.Equal($"GET {path} HTTP/1.1", upstream.RequestLine);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/swagger")]
    public async Task UnroutedPath_ShouldBeRejectedByNginx(string path)
    {
        using var client = gateway.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Host_ShouldBeTheHostTheClientUsed()
    {
        using var client = gateway.CreateClient();

        var upstream = await SendThroughGatewayAsync(new HttpRequestMessage(HttpMethod.Get, "/api/auctions"));

        Assert.Equal(client.BaseAddress!.Host, upstream.Header("Host"));
    }

    [Theory]
    [InlineData("/api/auctions")]
    [InlineData("/health/ready")]
    public async Task ForwardedFor_WhenClientSpoofsIt_ShouldCarryOnlyTheConnectingAddress(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add("X-Forwarded-For", "6.6.6.6");

        var upstream = await SendThroughGatewayAsync(request);

        var forwardedFor = upstream.Header("X-Forwarded-For");
        Assert.True(IPAddress.TryParse(forwardedFor, out _), $"X-Forwarded-For was '{forwardedFor}'");
        Assert.NotEqual("6.6.6.6", forwardedFor);
    }

    [Theory]
    [InlineData("/api/auctions")]
    [InlineData("/health/ready")]
    public async Task ForwardedProto_ShouldTellUpstreamTheClientScheme(string path)
    {
        var upstream = await SendThroughGatewayAsync(new HttpRequestMessage(HttpMethod.Get, path));

        Assert.Equal("http", upstream.Header("X-Forwarded-Proto"));
    }

    [Theory]
    [InlineData("/api/auctions")]
    [InlineData("/health/ready")]
    public async Task RequestId_WhenClientSendsOne_ShouldBeReplacedWithGeneratedId(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add("X-Request-Id", "client-chosen");

        var upstream = await SendThroughGatewayAsync(request);

        Assert.Matches("^[0-9a-f]{32}$", upstream.Header("X-Request-Id") ?? "");
    }
}
