using System.Security.Cryptography;
using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.UploadAvatar;

public sealed class UploadAvatarCommandHandler(
    IProfilesRepository repository,
    IAvatarStorage storage,
    ProfilesOptions options) : IRequestHandler<UploadAvatarCommand>
{
    public async Task Handle(UploadAvatarCommand request, CancellationToken token)
    {
        if (request.Payload.Length == 0)
            throw new ProfilesExceptions.InvalidAvatarException("Avatar file is empty");
        if (request.Payload.Length > options.Avatar.MaxBytes)
            throw new ProfilesExceptions.InvalidAvatarException(
                $"Avatar file exceeds the limit of {options.Avatar.MaxBytes} bytes");

        var contentType = AvatarImage.Sniff(request.Payload)
            ?? throw new ProfilesExceptions.InvalidAvatarException(
                "Avatar file must be a jpeg, png or webp image");

        var profile = await repository.GetProfileAsync(request.UserId, token);

        await storage.PutAsync(request.UserId, request.Payload, contentType, token);

        var hash = Convert.ToHexStringLower(SHA256.HashData(request.Payload));
        profile.SetAvatar(contentType, hash, DateTime.UtcNow);
        await repository.SaveChangesAsync(CancellationToken.None);
    }
}
