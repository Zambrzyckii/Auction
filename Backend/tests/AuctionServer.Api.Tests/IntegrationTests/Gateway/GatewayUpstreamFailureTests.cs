using System.Net;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

[Collection(GatewayCollection.Name)]
public class GatewayUpstreamFailureTests(UnreachableUpstreamGatewayFixture gateway)
    : IClassFixture<UnreachableUpstreamGatewayFixture>
{
    [Fact]
    public async Task UnreachableApi_ShouldAnswerWithJson502()
    {
        using var client = gateway.CreateClient();

        var response = await client.GetAsync("/api/auctions?limit=5");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("{\"error\":\"Api unavailable\"}", await response.Content.ReadAsStringAsync());
    }
}
