using System.Net;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(HostIntegrationCollection.Name)]
public class HostSmokeTests(CustomApi factory)
{
    [Fact]
    public async Task HealthEndpoint_WhenDatabaseIsReachable_ShouldReturnHealthy()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task OpenApiDocument_ShouldBeServed()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("/api/auctions", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task CorsPreflight_FromAllowedOrigin_ShouldAllowIt()
    {
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/auctions");
        request.Headers.Add("Origin", "http://localhost:4200");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:4200",
            Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }
}
