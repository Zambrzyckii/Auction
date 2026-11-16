using AuctionServer.Modules.Identity.Application.Tokens;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Login;

public record LoginCommand(string Email, string Password) : IRequest<SessionTokensDto>;
