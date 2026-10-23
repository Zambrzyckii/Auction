using System.Net;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

[Collection(GatewayCollection.Name)]
public class GatewayPublicClientTests(PublicNetworkGatewayFixture gateway) : IClassFixture<PublicNetworkGatewayFixture>
{
    [Fact]
    public async Task OpenApi_FromPublicAddress_ShouldBeForbidden()
    {
        Assert.Equal(HttpStatusCode.Forbidden, await gateway.GetFromNetworkAddressAsync("/openapi/v1.json"));
    }

    [Fact]
    public async Task Api_FromPublicAddress_ShouldReachUpstream()
    {
        Assert.Equal(HttpStatusCode.OK, await gateway.GetFromNetworkAddressAsync("/api/auctions"));
    }
}
