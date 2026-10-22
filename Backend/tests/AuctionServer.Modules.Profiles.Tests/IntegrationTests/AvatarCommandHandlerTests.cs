using System.Security.Cryptography;
using AuctionServer.Modules.Profiles.Application.Command.DeleteAvatar;
using AuctionServer.Modules.Profiles.Application.Command.UploadAvatar;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class AvatarCommandHandlerTests(ProfilesPostgresFixture fixture)
{
    private static byte[] Png(byte filler = 0x00) =>
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, filler, filler];

    private static ProfilesOptions TestOptions(int maxBytes) => new(
        new AvatarOptions(maxBytes),
        new InviteOptions(TimeSpan.FromMinutes(15)),
        new StorageOptions("http://localhost:8333", "avatars", true));

    private async Task UploadAsync(Guid userId, byte[] payload, FakeAvatarStorage storage, int maxBytes = 1024)
    {
        await using var context = fixture.CreateContext();
        var handler = new UploadAvatarCommandHandler(
            new ProfilesRepository(context), storage, TestOptions(maxBytes));
        await handler.Handle(new UploadAvatarCommand(userId, payload), CancellationToken.None);
    }

    private async Task DeleteAsync(Guid userId, FakeAvatarStorage storage)
    {
        await using var context = fixture.CreateContext();
        var handler = new DeleteAvatarCommandHandler(new ProfilesRepository(context), storage);
        await handler.Handle(new DeleteAvatarCommand(userId), CancellationToken.None);
    }

    [Fact]
    public async Task Upload_WithPngPayload_ShouldStoreObjectAndMetadata()
    {
        var userId = await fixture.SeedProfileAsync();
        var storage = new FakeAvatarStorage();

        await UploadAsync(userId, Png(), storage);

        Assert.Equal("image/png", storage.Objects[userId].ContentType);
        var profile = await fixture.GetProfileAsync(userId);
        Assert.Equal("image/png", profile.AvatarContentType);
        Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(Png())), profile.AvatarHash);
        Assert.NotNull(profile.AvatarUpdatedOn);
    }

    [Fact]
    public async Task Upload_WhenReplacingAvatar_ShouldChangeHash()
    {
        var userId = await fixture.SeedProfileAsync();
        var storage = new FakeAvatarStorage();

        await UploadAsync(userId, Png(0x01), storage);
        var firstHash = (await fixture.GetProfileAsync(userId)).AvatarHash;

        await UploadAsync(userId, Png(0x02), storage);
        var secondHash = (await fixture.GetProfileAsync(userId)).AvatarHash;

        Assert.NotEqual(firstHash, secondHash);
        Assert.Equal(Png(0x02), storage.Objects[userId].Payload);
    }

    [Fact]
    public async Task Upload_WithOversizePayload_ShouldRejectBeforeStorage()
    {
        var userId = await fixture.SeedProfileAsync();
        var storage = new FakeAvatarStorage();
        var payload = new byte[2048];

        await Assert.ThrowsAsync<ProfilesExceptions.InvalidAvatarException>(() =>
            UploadAsync(userId, payload, storage, maxBytes: 1024));

        Assert.Equal(0, storage.PutCalls);
        Assert.Null((await fixture.GetProfileAsync(userId)).AvatarHash);
    }

    [Fact]
    public async Task Upload_WithNonImagePayload_ShouldRejectBeforeStorage()
    {
        var userId = await fixture.SeedProfileAsync();
        var storage = new FakeAvatarStorage();

        await Assert.ThrowsAsync<ProfilesExceptions.InvalidAvatarException>(() =>
            UploadAsync(userId, "GIF89a not an avatar"u8.ToArray(), storage));

        Assert.Equal(0, storage.PutCalls);
    }

    [Fact]
    public async Task Upload_WithEmptyPayload_ShouldReject()
    {
        var userId = await fixture.SeedProfileAsync();

        await Assert.ThrowsAsync<ProfilesExceptions.InvalidAvatarException>(() =>
            UploadAsync(userId, [], new FakeAvatarStorage()));
    }

    [Fact]
    public async Task Upload_WhenStorageFails_ShouldLeaveProfileUnchanged()
    {
        var userId = await fixture.SeedProfileAsync();
        var storage = new FakeAvatarStorage { FailOnPut = true };

        await Assert.ThrowsAsync<ProfilesExceptions.AvatarStorageUnavailableException>(() =>
            UploadAsync(userId, Png(), storage));

        Assert.Null((await fixture.GetProfileAsync(userId)).AvatarHash);
    }

    [Fact]
    public async Task Delete_ShouldClearStorageAndMetadata()
    {
        var userId = await fixture.SeedProfileAsync();
        var storage = new FakeAvatarStorage();
        await UploadAsync(userId, Png(), storage);

        await DeleteAsync(userId, storage);

        Assert.Empty(storage.Objects);
        var profile = await fixture.GetProfileAsync(userId);
        Assert.Null(profile.AvatarContentType);
        Assert.Null(profile.AvatarHash);
        Assert.Null(profile.AvatarUpdatedOn);
    }

    [Fact]
    public async Task Delete_WhenNoAvatar_ShouldStillSucceed()
    {
        var userId = await fixture.SeedProfileAsync();

        await DeleteAsync(userId, new FakeAvatarStorage());

        Assert.Null((await fixture.GetProfileAsync(userId)).AvatarHash);
    }
}
