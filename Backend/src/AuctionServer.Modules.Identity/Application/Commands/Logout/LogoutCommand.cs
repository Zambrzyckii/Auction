using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Logout;

public record LogoutCommand(string RefreshToken) : IRequest;
