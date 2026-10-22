using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetProfile;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;

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
}
