using AuctionServer.Modules.Identity.Application.Tokens;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.RefreshSession;

public record RefreshSessionCommand(string RefreshToken) : IRequest<SessionTokensDto>;
