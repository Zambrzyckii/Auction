using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesHostCollection.Name)]
public class ProfilesApiSmokeTests(ProfilesCustomApi factory)
{
    private static readonly byte[] PngPayload =
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x33, 0x44];

    [Fact]
    public async Task PutAvatar_WithMultipartPng_ShouldReturnOkAndExposeAvatarUrl()
    {
        var userId = await SeedProfileAsync();
        var client = CreateAuthorizedClient(userId);

        var response = await client.PutAsync("/api/profiles/me/avatar", Multipart(PngPayload));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await client.GetFromJsonAsync<JsonElement>("/api/profiles/me");
        var avatarUrl = me.GetProperty("avatarUrl").GetString();
        Assert.NotNull(avatarUrl);
        Assert.StartsWith($"/api/profiles/{userId}/avatar?v=", avatarUrl);
    }

    [Fact]
    public async Task PutAvatar_WithOversizeFile_ShouldReturnClientErrorNotServerError()
    {
        var userId = await SeedProfileAsync();
        var client = CreateAuthorizedClient(userId);
        var oversize = new byte[3 * 1024 * 1024];

        var response = await client.PutAsync("/api/profiles/me/avatar", Multipart(oversize));

        Assert.True((int)response.StatusCode is >= 400 and < 500,
            $"Expected a client error but got {(int)response.StatusCode}");
    }

    [Fact]
    public async Task PutAvatar_WithGifFile_ShouldReturnBadRequest()
    {
        var userId = await SeedProfileAsync();
        var client = CreateAuthorizedClient(userId);

        var response = await client.PutAsync("/api/profiles/me/avatar",
            Multipart("GIF89a definitely a gif"u8.ToArray(), "avatar.gif"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutAvatar_WhenAnonymous_ShouldReturnUnauthorized()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsync("/api/profiles/me/avatar", Multipart(PngPayload));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetAvatar_ShouldStreamBytesWithContentTypeNosniffAndETag()
    {
        var userId = await SeedProfileAsync();
        var client = CreateAuthorizedClient(userId);
        await client.PutAsync("/api/profiles/me/avatar", Multipart(PngPayload));

        var response = await client.GetAsync($"/api/profiles/{userId}/avatar");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.NotNull(response.Headers.ETag);
        Assert.Equal(PngPayload, await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task DeleteAvatar_ShouldReturnNoContentAndRemoveAvatar()
    {
        var userId = await SeedProfileAsync();
        var client = CreateAuthorizedClient(userId);
        await client.PutAsync("/api/profiles/me/avatar", Multipart(PngPayload));

        var deleteResponse = await client.DeleteAsync("/api/profiles/me/avatar");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var avatarResponse = await client.GetAsync($"/api/profiles/{userId}/avatar");
        Assert.Equal(HttpStatusCode.NotFound, avatarResponse.StatusCode);
        var me = await client.GetFromJsonAsync<JsonElement>("/api/profiles/me");
        Assert.Equal(JsonValueKind.Null, me.GetProperty("avatarUrl").ValueKind);
    }

    private async Task<Guid> SeedProfileAsync()
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        var profile = UserProfile.Create(Guid.NewGuid(), "smoke-player", DateTime.UtcNow);
        context.UserProfiles.Add(profile);
        await context.SaveChangesAsync();
        return profile.UserId;
    }

    private HttpClient CreateAuthorizedClient(Guid userId)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateTokenFor(userId));
        return client;
    }

    private static MultipartFormDataContent Multipart(byte[] payload, string fileName = "avatar.png")
    {
        var file = new ByteArrayContent(payload);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private static string CreateTokenFor(Guid userId)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(ProfilesCustomApi.TestJwtKey);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, "User")
            ]),
            Issuer = "AuctionServer",
            Audience = "AuctionServer.Client",
            Expires = DateTime.UtcNow.AddMinutes(15),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        return tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));
    }
}
