using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AuctionServer.Api.Infrastructure.Authentication;
using AuctionServer.Modules.Identity.Application.Tokens;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(HostIntegrationCollection.Name)]
public class SessionApiTests(CustomApi factory)
{
    private const string Password = "Password123!";

    private static object CreateRegisterRequest(string email) => new
    {
        email,
        password = Password,
        username = IdentityPostgresFixture.UniqueUsername(),
        name = "Jan",
        surname = "Kowalski",
        birthday = "2000-01-01"
    };

    private static async Task<JsonElement> LoginAsync(HttpClient client, string email)
    {
        var response = await client.PostAsJsonAsync("/api/users/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<JsonElement> RegisterAndLoginAsync(HttpClient client)
    {
        var email = IdentityPostgresFixture.UniqueEmail();
        var registered = await client.PostAsJsonAsync("/api/users/register", CreateRegisterRequest(email));
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        return await LoginAsync(client, email);
    }

    private static Task<HttpResponseMessage> RefreshAsync(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/users/refresh", body);

    private static Task<HttpResponseMessage> LogoutAsync(HttpClient client, string refreshToken) =>
        client.PostAsJsonAsync("/api/users/logout", new { refreshToken });

    private static async Task AssertInvalidRefreshTokenAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Invalid refresh token", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Login_WhenPlayerLogsIn_ShouldReturnTokenAndRefreshToken()
    {
        var client = factory.CreateClient();

        var payload = await RegisterAndLoginAsync(client);

        Assert.False(string.IsNullOrEmpty(payload.GetProperty("token").GetString()));
        Assert.Matches("^[A-Za-z0-9_-]{43}$", payload.GetProperty("refreshToken").GetString());
    }

    [Fact]
    public async Task Login_WhenBotLogsIn_ShouldReturnNullRefreshToken()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(ApiKeyAuthenticationOptions.HeaderName, CustomApi.TestApiKey);
        var email = IdentityPostgresFixture.UniqueEmail();
        var provisioned = await client.PostAsJsonAsync("/api/users/bots", CreateRegisterRequest(email));
        Assert.Equal(HttpStatusCode.Created, provisioned.StatusCode);

        var payload = await LoginAsync(client, email);

        Assert.False(string.IsNullOrEmpty(payload.GetProperty("token").GetString()));
        Assert.Equal(JsonValueKind.Null, payload.GetProperty("refreshToken").ValueKind);
    }

    [Fact]
    public async Task Refresh_WhenTokenIsValid_ShouldRotateAndRejectTheOldToken()
    {
        var client = factory.CreateClient();
        var first = (await RegisterAndLoginAsync(client)).GetProperty("refreshToken").GetString()!;

        var rotated = await RefreshAsync(client, new { refreshToken = first });

        Assert.Equal(HttpStatusCode.OK, rotated.StatusCode);
        var payload = await rotated.Content.ReadFromJsonAsync<JsonElement>();
        var second = payload.GetProperty("refreshToken").GetString()!;
        Assert.False(string.IsNullOrEmpty(payload.GetProperty("token").GetString()));
        Assert.NotEqual(first, second);
        await AssertInvalidRefreshTokenAsync(await RefreshAsync(client, new { refreshToken = first }));
        await AssertInvalidRefreshTokenAsync(await RefreshAsync(client, new { refreshToken = second }));
    }

    [Fact]
    public async Task Refresh_WhenTokenIsUnknown_ShouldReturnBadRequestWithError()
    {
        var client = factory.CreateClient();

        var response = await RefreshAsync(client, new { refreshToken = RefreshTokenSecret.Generate() });

        await AssertInvalidRefreshTokenAsync(response);
    }

    [Fact]
    public async Task Refresh_WhenBodyHasNoToken_ShouldReturnBadRequest()
    {
        var client = factory.CreateClient();

        var response = await RefreshAsync(client, new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Logout_WhenTokenIsUnknown_ShouldReturnOkWithEmptyBody()
    {
        var client = factory.CreateClient();

        var response = await LogoutAsync(client, RefreshTokenSecret.Generate());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Logout_WhenTokenIsActive_ShouldMakeTheNextRefreshFail()
    {
        var client = factory.CreateClient();
        var refreshToken = (await RegisterAndLoginAsync(client)).GetProperty("refreshToken").GetString()!;

        var response = await LogoutAsync(client, refreshToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await AssertInvalidRefreshTokenAsync(await RefreshAsync(client, new { refreshToken }));
    }
}
