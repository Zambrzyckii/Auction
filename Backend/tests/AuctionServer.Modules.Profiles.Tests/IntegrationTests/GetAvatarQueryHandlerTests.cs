using System.Security.Cryptography;
using AuctionServer.Modules.Profiles.Application.Command.UploadAvatar;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Application.Queries.GetAvatar;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class GetAvatarQueryHandlerTests(ProfilesPostgresFixture fixture)
{
    private static readonly byte[] PngPayload =
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x11, 0x22];

    private async Task<Guid> SeedWithAvatarAsync(FakeAvatarStorage storage)
    {
        var userId = await fixture.SeedProfileAsync();
        await using var context = fixture.CreateContext();
        var handler = new UploadAvatarCommandHandler(
            new ProfilesRepository(context), storage, new ProfilesOptions(
                new AvatarOptions(1024),
                new InviteOptions(TimeSpan.FromMinutes(15)),
                new StorageOptions("http://localhost:8333", "avatars", true)));
        await handler.Handle(new UploadAvatarCommand(userId, PngPayload), CancellationToken.None);
        return userId;
    }

    private async Task<AvatarStreamDto> QueryAsync(Guid userId, FakeAvatarStorage storage)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetAvatarQueryHandler(new ProfilesRepository(context), storage);
        return await handler.Handle(new GetAvatarQuery(userId), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldReturnStreamContentTypeAndHash()
    {
        var storage = new FakeAvatarStorage();
        var userId = await SeedWithAvatarAsync(storage);

        var dto = await QueryAsync(userId, storage);

        using var memory = new MemoryStream();
        await dto.Content.CopyToAsync(memory);
        Assert.Equal(PngPayload, memory.ToArray());
        Assert.Equal("image/png", dto.ContentType);
        Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(PngPayload)), dto.Hash);
    }

    [Fact]
    public async Task Handle_WhenProfileHasNoAvatar_ShouldThrowNotFound()
    {
        var userId = await fixture.SeedProfileAsync();

        await Assert.ThrowsAsync<ProfilesExceptions.AvatarNotFoundException>(() =>
            QueryAsync(userId, new FakeAvatarStorage()));
    }

    [Fact]
    public async Task Handle_WhenProfileIsMissing_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<ProfilesExceptions.AvatarNotFoundException>(() =>
            QueryAsync(Guid.NewGuid(), new FakeAvatarStorage()));
    }

    [Fact]
    public async Task Handle_WhenObjectVanishedFromStorage_ShouldThrowNotFound()
    {
        var storage = new FakeAvatarStorage();
        var userId = await SeedWithAvatarAsync(storage);
        await storage.DeleteAsync(userId, CancellationToken.None);

        await Assert.ThrowsAsync<ProfilesExceptions.AvatarNotFoundException>(() =>
            QueryAsync(userId, storage));
    }
}
