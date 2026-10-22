using AuctionServer.Modules.Profiles.Application.Command.ReplaceSocialLinks;
using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class ReplaceSocialLinksCommandHandlerTests(ProfilesPostgresFixture fixture)
{
    private async Task HandleAsync(Guid userId, params SocialLinkRequest[] links)
    {
        await using var context = fixture.CreateContext();
        var handler = new ReplaceSocialLinksCommandHandler(new ProfilesRepository(context));
        await handler.Handle(new ReplaceSocialLinksCommand(userId, links), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldPersistLinksAndQueryReturnsThemOrderedByPlatform()
    {
        var userId = await fixture.SeedProfileAsync();

        await HandleAsync(userId,
            new SocialLinkRequest(SocialPlatform.GitHub, "https://github.com/player"),
            new SocialLinkRequest(SocialPlatform.Twitch, "https://twitch.tv/player"));

        await using var context = fixture.CreateContext();
        var queryHandler = new GetOwnProfileQueryHandler(new ProfilesRepository(context));
        var dto = await queryHandler.Handle(new GetOwnProfileQuery(userId), CancellationToken.None);

        Assert.Equal(2, dto.SocialLinks.Count);
        Assert.Equal(SocialPlatform.Twitch, dto.SocialLinks[0].Platform);
        Assert.Equal("https://twitch.tv/player", dto.SocialLinks[0].Url);
        Assert.Equal(SocialPlatform.GitHub, dto.SocialLinks[1].Platform);
    }

    [Fact]
    public async Task Handle_WithSamePlatformNewUrl_ShouldKeepSingleRowWithNewUrl()
    {
        var userId = await fixture.SeedProfileAsync();
        await HandleAsync(userId, new SocialLinkRequest(SocialPlatform.Twitch, "https://twitch.tv/old"));

        await HandleAsync(userId, new SocialLinkRequest(SocialPlatform.Twitch, "https://twitch.tv/new"));

        var profile = await fixture.GetProfileAsync(userId);
        var link = Assert.Single(profile.SocialLinks);
        Assert.Equal("https://twitch.tv/new", link.Url);
    }

    [Fact]
    public async Task Handle_WithEmptyList_ShouldClearLinks()
    {
        var userId = await fixture.SeedProfileAsync();
        await HandleAsync(userId, new SocialLinkRequest(SocialPlatform.X, "https://x.com/player"));

        await HandleAsync(userId);

        var profile = await fixture.GetProfileAsync(userId);
        Assert.Empty(profile.SocialLinks);
    }

    [Fact]
    public async Task Handle_WhenProfileIsMissing_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<ProfilesExceptions.ProfileNotFoundException>(() =>
            HandleAsync(Guid.NewGuid(), new SocialLinkRequest(SocialPlatform.Twitch, "https://twitch.tv/ghost")));
    }

    [Fact]
    public async Task Handle_WhenProfileChangedConcurrently_ShouldThrowConcurrencyConflict()
    {
        var userId = await fixture.SeedProfileAsync();

        await using var staleContext = fixture.CreateContext();
        var staleRepository = new ProfilesRepository(staleContext);
        var staleProfile = await staleRepository.GetProfileAsync(userId, CancellationToken.None);

        await HandleAsync(userId, new SocialLinkRequest(SocialPlatform.Twitch, "https://twitch.tv/winner"));

        staleProfile.ReplaceSocialLinks([(SocialPlatform.X, "https://x.com/loser")]);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() =>
            staleRepository.SaveChangesAsync(CancellationToken.None));
    }
}
