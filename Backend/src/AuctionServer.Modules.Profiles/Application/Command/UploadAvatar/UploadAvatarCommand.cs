using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.UploadAvatar;

public record UploadAvatarCommand(Guid UserId, byte[] Payload) : IRequest;
