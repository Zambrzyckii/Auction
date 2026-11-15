using System.Security.Cryptography;
using AuctionServer.Modules.Profiles.Application.Command.UploadAvatar;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Application.Queries;
using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetProfileSummaries;
using AuctionServer.Modules.Profiles.Application.Queries.SearchProfiles;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class ProfileQueryHandlerTests(ProfilesPostgresFixture fixture)
{
    [Fact]
    public async Task GetProfile_ShouldReturnUsernameAndLevel()
    {
        var userId = await fixture.SeedProfileAsync("visible-player");

        await using var context = fixture.CreateContext();
        var handler = new GetProfileQueryHandler(new ProfilesRepository(context));
        var dto = await handler.Handle(new GetProfileQuery(userId, Guid.NewGuid()), CancellationToken.None);

        Assert.Equal(userId, dto.UserId);
        Assert.Equal("visible-player", dto.Username);
        Assert.Equal(0, dto.Level);
    }

    [Fact]
    public async Task GetProfile_WhenProfileIsMissing_ShouldThrowNotFound()
    {
        await using var context = fixture.CreateContext();
        var handler = new GetProfileQueryHandler(new ProfilesRepository(context));

        await Assert.ThrowsAsync<ProfilesExceptions.ProfileNotFoundException>(() =>
            handler.Handle(new GetProfileQuery(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None));
    }

    [Fact]
    public async Task GetOwnProfile_WhenProfileIsMissing_ShouldThrowNotFound()
    {
        await using var context = fixture.CreateContext();
        var handler = new GetOwnProfileQueryHandler(new ProfilesRepository(context));

        await Assert.ThrowsAsync<ProfilesExceptions.ProfileNotFoundException>(() =>
            handler.Handle(new GetOwnProfileQuery(Guid.NewGuid()), CancellationToken.None));
    }

    private static readonly byte[] PngPayload =
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x55, 0x66];

    private async Task<string> UploadAvatarAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        var handler = new UploadAvatarCommandHandler(new ProfilesRepository(context), new FakeAvatarStorage(),
            new ProfilesOptions(
                new AvatarOptions(1024),
                new InviteOptions(TimeSpan.FromMinutes(15)),
                new StorageOptions("http://localhost:8333", "avatars", true)));
        await handler.Handle(new UploadAvatarCommand(userId, PngPayload), CancellationToken.None);
        return Convert.ToHexStringLower(SHA256.HashData(PngPayload));
    }

    private async Task<IReadOnlyList<ProfileSummaryDto>> LookupAsync(params Guid[] userIds)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetProfileSummariesQueryHandler(new ProfilesRepository(context));
        return await handler.Handle(new GetProfileSummariesQuery(userIds), CancellationToken.None);
    }

    private async Task<IReadOnlyList<ProfileSummaryDto>> SearchAsync(string query, int limit = 20)
    {
        await using var context = fixture.CreateContext();
        var handler = new SearchProfilesQueryHandler(new ProfilesRepository(context));
        return await handler.Handle(new SearchProfilesQuery(query, limit), CancellationToken.None);
    }

    [Fact]
    public async Task GetProfileSummaries_ShouldReturnKnownIdsWithAvatarUrlFromHash()
    {
        var withAvatar = await fixture.SeedProfileAsync("summary-with-avatar");
        var withoutAvatar = await fixture.SeedProfileAsync("summary-without-avatar");
        var hash = await UploadAvatarAsync(withAvatar);

        var rows = await LookupAsync(withAvatar, withoutAvatar, Guid.NewGuid());

        Assert.Equal(2, rows.Count);
        var first = Assert.Single(rows, r => r.UserId == withAvatar);
        Assert.Equal("summary-with-avatar", first.Username);
        Assert.Equal($"/api/profiles/{withAvatar}/avatar?v={hash[..12]}", first.AvatarUrl);
        var second = Assert.Single(rows, r => r.UserId == withoutAvatar);
        Assert.Equal("summary-without-avatar", second.Username);
        Assert.Null(second.AvatarUrl);
    }

    [Fact]
    public async Task GetProfileSummaries_WhenNoIdIsKnown_ShouldReturnEmptyList()
    {
        var rows = await LookupAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.Empty(rows);
    }

    [Fact]
    public async Task GetProfileSummaries_ShouldIncludePrivateProfileWithNameAndAvatar()
    {
        var userId = await fixture.SeedProfileAsync("summary-private");
        var hash = await UploadAvatarAsync(userId);
        await using (var context = fixture.CreateContext())
        {
            var profile = await context.UserProfiles.SingleAsync(p => p.UserId == userId);
            profile.SetPrivacy(true);
            await context.SaveChangesAsync();
        }

        var row = Assert.Single(await LookupAsync(userId));

        Assert.Equal("summary-private", row.Username);
        Assert.Equal($"/api/profiles/{userId}/avatar?v={hash[..12]}", row.AvatarUrl);
    }

    [Fact]
    public async Task SearchProfiles_ShouldMatchThePrefixIgnoringCase()
    {
        var target = await fixture.SeedProfileAsync("CaseProbe-Player");
        await fixture.SeedProfileAsync("xcaseprobe-player");

        var rows = await SearchAsync("caseprobe-");

        var row = Assert.Single(rows);
        Assert.Equal(target, row.UserId);
        Assert.Equal("CaseProbe-Player", row.Username);
        Assert.Null(row.AvatarUrl);
    }

    [Fact]
    public async Task SearchProfiles_ShouldOrderByUsernameAndHonourTheLimit()
    {
        var third = await fixture.SeedProfileAsync("ord-c3");
        var first = await fixture.SeedProfileAsync("ord-a1");
        var second = await fixture.SeedProfileAsync("ord-b2");

        var all = await SearchAsync("ord-");
        var limited = await SearchAsync("ord-", 2);

        Assert.Equal(new[] { first, second, third }, all.Select(r => r.UserId).ToList());
        Assert.Equal(new[] { first, second }, limited.Select(r => r.UserId).ToList());
    }

    [Theory]
    [InlineData("pct%", "pct%literal", "pctXliteral")]
    [InlineData("und_", "und_literal", "undXliteral")]
    public async Task SearchProfiles_ShouldTreatWildcardsInTheQueryLiterally(
        string query, string matching, string decoy)
    {
        var expected = await fixture.SeedProfileAsync(matching);
        await fixture.SeedProfileAsync(decoy);

        var rows = await SearchAsync(query);

        var row = Assert.Single(rows);
        Assert.Equal(expected, row.UserId);
    }
}
