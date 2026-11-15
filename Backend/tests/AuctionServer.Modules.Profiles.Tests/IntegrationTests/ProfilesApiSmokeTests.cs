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

    [Fact]
    public async Task PutPrivacy_ShouldHideProfileDetailsFromStrangers()
    {
        var ownerId = await SeedProfileAsync();
        var strangerId = await SeedProfileAsync();
        var owner = CreateAuthorizedClient(ownerId);
        var stranger = CreateAuthorizedClient(strangerId);

        var response = await owner.PutAsJsonAsync("/api/profiles/me/privacy", new { IsPrivate = true });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var me = await owner.GetFromJsonAsync<JsonElement>("/api/profiles/me");
        Assert.True(me.GetProperty("isPrivate").GetBoolean());
        var profile = await stranger.GetFromJsonAsync<JsonElement>($"/api/profiles/{ownerId}");
        Assert.True(profile.GetProperty("isPrivate").GetBoolean());
        Assert.Equal(JsonValueKind.Null, profile.GetProperty("level").ValueKind);
        Assert.Equal("smoke-player", profile.GetProperty("username").GetString());
    }

    [Fact]
    public async Task PostWarehouseInvite_ShouldReturnCreatedWithInviteIdAndLocation()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var inviter = CreateAuthorizedClient(inviterId);

        var response = await inviter.PostAsJsonAsync("/api/profiles/warehouse-invites",
            new { FriendUserId = inviteeId, PublicWarehouseId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/profiles/warehouse-invites", response.Headers.Location?.ToString());
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var publicInviteId = body.GetProperty("publicInviteId").GetGuid();
        var invites = await CreateAuthorizedClient(inviteeId)
            .GetFromJsonAsync<JsonElement>("/api/profiles/warehouse-invites");
        Assert.Equal(publicInviteId, invites.EnumerateArray().Single().GetProperty("publicInviteId").GetGuid());
    }

    [Fact]
    public async Task DeclineWarehouseInvite_ShouldReturnOkOnceThenNotFound()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var created = await CreateAuthorizedClient(inviterId).PostAsJsonAsync("/api/profiles/warehouse-invites",
            new { FriendUserId = inviteeId, PublicWarehouseId = Guid.NewGuid() });
        var publicInviteId = (await created.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("publicInviteId").GetGuid();
        var invitee = CreateAuthorizedClient(inviteeId);

        var first = await invitee.PostAsync($"/api/profiles/warehouse-invites/{publicInviteId}/decline", null);
        var second = await invitee.PostAsync($"/api/profiles/warehouse-invites/{publicInviteId}/decline", null);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
    }

    [Fact]
    public async Task GetProfiles_WithIds_ShouldReturnOnlyTheKnownSummaries()
    {
        var known = await SeedProfileAsync("lookup-known");
        var callerId = await SeedProfileAsync();
        var client = CreateAuthorizedClient(callerId);

        var rows = await client.GetFromJsonAsync<JsonElement>(
            $"/api/profiles?ids={known}&ids={callerId}&ids={Guid.NewGuid()}");

        var byId = rows.EnumerateArray().ToDictionary(r => r.GetProperty("userId").GetGuid());
        Assert.Equal(2, byId.Count);
        Assert.Equal("lookup-known", byId[known].GetProperty("username").GetString());
        Assert.Equal(JsonValueKind.Null, byId[known].GetProperty("avatarUrl").ValueKind);
    }

    [Fact]
    public async Task SearchProfiles_ShouldReturnTheMatchesForThePrefix()
    {
        var target = await SeedProfileAsync("search-target");
        var client = CreateAuthorizedClient(target);

        var rows = await client.GetFromJsonAsync<JsonElement>("/api/profiles/search?q=search-tar");

        var row = Assert.Single(rows.EnumerateArray());
        Assert.Equal(target, row.GetProperty("userId").GetGuid());
        Assert.Equal("search-target", row.GetProperty("username").GetString());
    }

    [Fact]
    public async Task SearchProfiles_WithOneCharacter_ShouldReturnBadRequest()
    {
        var client = CreateAuthorizedClient(await SeedProfileAsync());

        var response = await client.GetAsync("/api/profiles/search?q=p");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/profiles?ids=00000000-0000-0000-0000-000000000001")]
    [InlineData("/api/profiles/search?q=pr")]
    public async Task GetLookups_WhenAnonymous_ShouldReturnUnauthorized(string path)
    {
        var response = await factory.CreateClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<Guid> SeedProfileAsync(string username = "smoke-player")
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        var profile = UserProfile.Create(Guid.NewGuid(), username, DateTime.UtcNow);
        context.UserProfiles.Add(profile);
        await context.SaveChangesAsync();
        return profile.UserId;
    }

    private async Task<(Guid InviterId, Guid InviteeId)> SeedFriendsAsync()
    {
        var inviterId = await SeedProfileAsync();
        var inviteeId = await SeedProfileAsync();
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        var friendship = Friendship.Create(inviterId, inviteeId, DateTime.UtcNow);
        friendship.Accept(inviteeId);
        context.Friendships.Add(friendship);
        await context.SaveChangesAsync();
        return (inviterId, inviteeId);
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
