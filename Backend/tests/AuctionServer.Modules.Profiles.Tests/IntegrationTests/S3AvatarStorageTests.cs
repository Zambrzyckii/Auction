using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Storage;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesStorageCollection.Name)]
public class S3AvatarStorageTests(ProfilesStorageFixture fixture)
{
    private S3AvatarStorage CreateStorage(string? serviceUrl = null) =>
        new(new StorageOptions(serviceUrl ?? fixture.ServiceUrl, "profiles-tests-avatars", true));

    [Fact]
    public async Task PutAndGet_ShouldRoundTripBytesAndContentType()
    {
        using var storage = CreateStorage();
        var userId = Guid.NewGuid();
        byte[] payload = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01];

        await storage.PutAsync(userId, payload, "image/png", CancellationToken.None);
        var download = await storage.GetAsync(userId, CancellationToken.None);

        Assert.NotNull(download);
        using var memory = new MemoryStream();
        await download.Content.CopyToAsync(memory);
        Assert.Equal(payload, memory.ToArray());
        Assert.Equal("image/png", download.ContentType);
    }

    [Fact]
    public async Task Put_ShouldOverwriteExistingKey()
    {
        using var storage = CreateStorage();
        var userId = Guid.NewGuid();
        await storage.PutAsync(userId, [0x01], "image/png", CancellationToken.None);

        await storage.PutAsync(userId, [0x02, 0x03], "image/webp", CancellationToken.None);
        var download = await storage.GetAsync(userId, CancellationToken.None);

        Assert.NotNull(download);
        using var memory = new MemoryStream();
        await download.Content.CopyToAsync(memory);
        Assert.Equal([0x02, 0x03], memory.ToArray());
        Assert.Equal("image/webp", download.ContentType);
    }

    [Fact]
    public async Task Get_WhenKeyIsMissing_ShouldReturnNull()
    {
        using var storage = CreateStorage();
        await storage.PutAsync(Guid.NewGuid(), [0x01], "image/png", CancellationToken.None);

        Assert.Null(await storage.GetAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ShouldBeIdempotentAndRemoveObject()
    {
        using var storage = CreateStorage();
        var userId = Guid.NewGuid();
        await storage.PutAsync(userId, [0x01], "image/png", CancellationToken.None);

        await storage.DeleteAsync(userId, CancellationToken.None);
        await storage.DeleteAsync(userId, CancellationToken.None);

        Assert.Null(await storage.GetAsync(userId, CancellationToken.None));
    }

    [Fact]
    public async Task Put_WhenEndpointIsUnreachable_ShouldThrowStorageUnavailable()
    {
        using var storage = CreateStorage("http://127.0.0.1:19");

        await Assert.ThrowsAsync<ProfilesExceptions.AvatarStorageUnavailableException>(() =>
            storage.PutAsync(Guid.NewGuid(), [0x01], "image/png", CancellationToken.None));
    }
}
