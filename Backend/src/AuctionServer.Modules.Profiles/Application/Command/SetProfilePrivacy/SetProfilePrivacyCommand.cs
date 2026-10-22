using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.SetProfilePrivacy;

public record SetProfilePrivacyCommand(Guid UserId, bool IsPrivate) : IRequest;
