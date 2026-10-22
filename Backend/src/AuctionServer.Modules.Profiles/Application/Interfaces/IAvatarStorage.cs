namespace AuctionServer.Modules.Profiles.Application.Interfaces;

public interface IAvatarStorage
{
    Task PutAsync(Guid userId, byte[] payload, string contentType, CancellationToken token);
    Task<AvatarDownload?> GetAsync(Guid userId, CancellationToken token);
    Task DeleteAsync(Guid userId, CancellationToken token);
}

public sealed record AvatarDownload(Stream Content, string ContentType);
