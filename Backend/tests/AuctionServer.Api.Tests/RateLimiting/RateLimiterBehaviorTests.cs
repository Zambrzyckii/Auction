using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace AuctionServer.Api.Tests.RateLimiting;

public class RateLimiterBehaviorTests(RateLimitedApi api) : IClassFixture<RateLimitedApi>
{
    private async Task<HttpClient> RegisterAndLoginAsync()
    {
        var client = api.Factory.CreateClient();
        var email = $"limiter{Guid.NewGuid():N}@test.pl";

        var register = await client.PostAsJsonAsync("/api/users/register", new
        {
            Email = email,
            Password = "Passw0rd!",
            Username = $"limiter{Guid.NewGuid():N}"[..20],
            Name = "Rate",
            Surname = "Limited",
            Birthday = "2000-01-01"
        });
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        var login = await client.PostAsJsonAsync("/api/users/login", new { Email = email, Password = "Passw0rd!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var payload = await login.Content.ReadFromJsonAsync<JsonElement>();
        var token = payload.GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static Task<HttpResponseMessage> HotWriteAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/wallets/transfers", new { RecipientId = Guid.NewGuid(), Amount = 1m });

    [Fact]
    public async Task HotWrites_OverTheBucket_ShouldGet429WithJsonError()
    {
        var client = await RegisterAndLoginAsync();

        for (var i = 0; i < 3; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await HotWriteAsync(client)).StatusCode);

        var rejected = await HotWriteAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.True(rejected.Headers.Contains("Retry-After"));
        Assert.Equal("""{"error":"Too many requests."}""", await rejected.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Reads_ShouldStayUnlimited()
    {
        var client = await RegisterAndLoginAsync();

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auctions?limit=5")).StatusCode);
    }

    [Fact]
    public async Task HotWrites_OfAnotherUser_ShouldHaveTheirOwnBucket()
    {
        var first = await RegisterAndLoginAsync();
        for (var i = 0; i < 4; i++) await HotWriteAsync(first);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await HotWriteAsync(first)).StatusCode);

        var second = await RegisterAndLoginAsync();

        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await HotWriteAsync(second)).StatusCode);
    }
}
