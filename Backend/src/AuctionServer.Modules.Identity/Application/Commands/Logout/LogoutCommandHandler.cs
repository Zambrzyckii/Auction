using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Application.Tokens;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Logout;

public sealed class LogoutCommandHandler(IRefreshTokenRepository repository) : IRequestHandler<LogoutCommand>
{
    public async Task Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var presented = await repository.GetByHashAsync(RefreshTokenSecret.Hash(request.RefreshToken), cancellationToken);
        if (presented is null || !presented.IsActive(now)) return;

        presented.Revoke(now);
        await repository.SaveChangesAsync(cancellationToken);
    }
}
