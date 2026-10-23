using System.Net;
using System.Net.Http.Headers;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

[Collection(GatewayCollection.Name)]
public class GatewayRateLimitTests(GatewayFixture gateway) : IClassFixture<GatewayFixture>
{
    private static Task<HttpResponseMessage[]> FloodAsync(HttpClient client, int count, Func<HttpRequestMessage> createRequest)
    {
        return Task.WhenAll(Enumerable.Range(0, count).Select(_ => client.SendAsync(createRequest())));
    }

    private static HttpRequestMessage Anonymous()
    {
        return new HttpRequestMessage(HttpMethod.Get, "/api/auctions");
    }

    private static HttpRequestMessage Authenticated()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/auctions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "any-token");
        return request;
    }

    private static HttpRequestMessage Login()
    {
        return new HttpRequestMessage(HttpMethod.Post, "/api/users/login") { Content = new StringContent("{}") };
    }

    [Fact]
    public async Task Anonymous_WhenFloodExceedsBurst_ShouldReturnJson429WithRetryAfter()
    {
        using var client = gateway.CreateClient();

        var responses = await FloodAsync(client, 80, Anonymous);

        var rejected = responses.FirstOrDefault(response => response.StatusCode == HttpStatusCode.TooManyRequests);
        Assert.NotNull(rejected);
        Assert.Equal("1", rejected.Headers.RetryAfter?.ToString());
        Assert.Equal("application/json", rejected.Content.Headers.ContentType?.MediaType);
        Assert.Equal("""{"error":"Too many requests"}""", await rejected.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Authenticated_WhenAnonymousBucketIsExhausted_ShouldStillPass()
    {
        using var client = gateway.CreateClient();
        var anonymous = await FloodAsync(client, 80, Anonymous);
        Assert.Contains(anonymous, response => response.StatusCode == HttpStatusCode.TooManyRequests);

        var authenticated = await FloodAsync(client, 60, Authenticated);

        Assert.All(authenticated, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
    }

    [Fact]
    public async Task Login_WhenFloodExceedsBurst_ShouldReturn429()
    {
        using var client = gateway.CreateClient();

        var responses = await FloodAsync(client, 15, Login);

        Assert.Contains(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Contains(responses, response => response.StatusCode == HttpStatusCode.TooManyRequests);
    }
}
