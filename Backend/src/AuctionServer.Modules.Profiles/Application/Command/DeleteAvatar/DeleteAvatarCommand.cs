using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.DeleteAvatar;

public record DeleteAvatarCommand(Guid UserId) : IRequest;
