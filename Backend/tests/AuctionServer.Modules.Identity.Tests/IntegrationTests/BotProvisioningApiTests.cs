using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using AuctionServer.Api.Infrastructure.Authentication;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

public class BotProvisioningApiTests(CustomApi factory) : IClassFixture<CustomApi>
{
    private sealed record CreatedBotResponse(Guid PublicUserId);
    private sealed record ErrorResponse(string Error);

    private static object CreateBotRequest(string? email = null) => new
    {
        email = email ?? IdentityPostgresFixture.UniqueEmail(),
        password = "Password123!",
        username = "bot-one",
        name = "Bot",
        surname = "One",
        birthday = "2000-01-01"
    };

    private static Task<HttpResponseMessage> PostBotAsync(HttpClient client, object request) =>
        client.PostAsJsonAsync("/api/users/bots", request);

    private HttpClient CreateProvisioningClient()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(ApiKeyAuthenticationOptions.HeaderName, CustomApi.TestApiKey);
        return client;
    }

    [Fact]
    public async Task RegisterBot_WhenApiKeyHeaderIsMissing_ShouldReturnUnauthorized()
    {
        var client = factory.CreateClient();

        var response = await PostBotAsync(client, CreateBotRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RegisterBot_WhenApiKeyIsWrong_ShouldReturnUnauthorized()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(ApiKeyAuthenticationOptions.HeaderName, "wrong-key");

        var response = await PostBotAsync(client, CreateBotRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RegisterBot_WhenOnlyBotJwtIsPresented_ShouldReturnUnauthorized()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateBotToken());

        var response = await PostBotAsync(client, CreateBotRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RegisterBot_WhenApiKeyIsValid_ShouldReturnCreatedWithPublicUserId()
    {
        var client = CreateProvisioningClient();
        var email = IdentityPostgresFixture.UniqueEmail();

        var response = await PostBotAsync(client, CreateBotRequest(email));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<CreatedBotResponse>();
        Assert.NotNull(body);
        Assert.NotEqual(Guid.Empty, body.PublicUserId);
        Assert.EndsWith($"/api/users/{body.PublicUserId}", response.Headers.Location!.ToString());

        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var user = await context.Users.SingleAsync(u => u.PublicUserId == body.PublicUserId);
        Assert.Equal(Role.Bot, user.UserRoles);
        Assert.Equal(email, user.Email);
    }

    [Fact]
    public async Task RegisterBot_WhenEmailIsTaken_ShouldReturnBadRequest()
    {
        var client = CreateProvisioningClient();
        var request = CreateBotRequest(IdentityPostgresFixture.UniqueEmail());
        await PostBotAsync(client, request);

        var response = await PostBotAsync(client, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("This email is taken", body?.Error);
    }

    private static string CreateBotToken()
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(CustomApi.TestJwtKey);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Role, "Bot")
            ]),
            Issuer = "AuctionServer",
            Audience = "AuctionServer.Client",
            Expires = DateTime.UtcNow.AddMinutes(15),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        return tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));
    }
}
