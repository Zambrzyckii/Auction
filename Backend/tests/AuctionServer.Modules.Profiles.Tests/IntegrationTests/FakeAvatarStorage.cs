using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

public sealed class FakeAvatarStorage : IAvatarStorage
{
    private readonly Dictionary<Guid, (byte[] Payload, string ContentType)> _objects = [];

    public bool FailOnPut { get; set; }
    public int PutCalls { get; private set; }
    public IReadOnlyDictionary<Guid, (byte[] Payload, string ContentType)> Objects => _objects;

    public Task PutAsync(Guid userId, byte[] payload, string contentType, CancellationToken token)
    {
        PutCalls++;
        if (FailOnPut) throw new ProfilesExceptions.AvatarStorageUnavailableException();
        _objects[userId] = (payload, contentType);
        return Task.CompletedTask;
    }

    public Task<AvatarDownload?> GetAsync(Guid userId, CancellationToken token) =>
        Task.FromResult<AvatarDownload?>(_objects.TryGetValue(userId, out var stored)
            ? new AvatarDownload(new MemoryStream(stored.Payload), stored.ContentType)
            : null);

    public Task DeleteAsync(Guid userId, CancellationToken token)
    {
        _objects.Remove(userId);
        return Task.CompletedTask;
    }
}
