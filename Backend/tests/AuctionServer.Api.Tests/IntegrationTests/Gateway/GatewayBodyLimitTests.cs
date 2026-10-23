using System.Net;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

[Collection(GatewayCollection.Name)]
public class GatewayBodyLimitTests(GatewayFixture gateway) : IClassFixture<GatewayFixture>
{
    private const int KiB = 1024;
    private const int MiB = 1024 * KiB;

    private async Task<HttpStatusCode> SendBodyAsync(HttpMethod method, string path, int bytes)
    {
        using var client = gateway.CreateClient();
        using var request = new HttpRequestMessage(method, path) { Content = new ByteArrayContent(new byte[bytes]) };
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        return response.StatusCode;
    }

    [Fact]
    public async Task Post_WhenBodyIsJsonSized_ShouldReachUpstream()
    {
        Assert.Equal(HttpStatusCode.OK, await SendBodyAsync(HttpMethod.Post, "/api/auctions", 16 * KiB));
    }

    [Fact]
    public async Task Post_WhenBodyExceedsDefaultLimit_ShouldReturn413()
    {
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,
            await SendBodyAsync(HttpMethod.Post, "/api/auctions", 512 * KiB));
    }

    [Fact]
    public async Task AvatarPut_WhenBodyIsAtApiRequestLimit_ShouldReachUpstream()
    {
        Assert.Equal(HttpStatusCode.OK,
            await SendBodyAsync(HttpMethod.Put, "/api/profiles/me/avatar", 2 * MiB + 8 * KiB));
    }

    [Fact]
    public async Task AvatarPut_WhenBodyIsFarOverApiLimit_ShouldReturn413()
    {
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,
            await SendBodyAsync(HttpMethod.Put, "/api/profiles/me/avatar", 6 * MiB));
    }

    [Fact]
    public async Task Put_WhenAvatarSizedBodyTargetsOtherPath_ShouldReturn413()
    {
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,
            await SendBodyAsync(HttpMethod.Put, "/api/profiles/me", 2 * MiB));
    }
}
