using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.RefreshSession;

public sealed class RefreshSessionCommandHandler(
    IRefreshTokenRepository repository,
    JwtTokenFactory jwtFactory) : IRequestHandler<RefreshSessionCommand, SessionTokensDto>
{
    public async Task<SessionTokensDto> Handle(RefreshSessionCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var presented = await repository.GetByHashAsync(RefreshTokenSecret.Hash(request.RefreshToken), cancellationToken);
        if (presented is null) throw new IdentityException.InvalidRefreshTokenException();
        if (presented.RevokedOn is not null)
        {
            await repository.RevokeFamilyAsync(presented.FamilyId, now, cancellationToken);
            throw new IdentityException.InvalidRefreshTokenException();
        }
        if (!presented.IsActive(now)) throw new IdentityException.InvalidRefreshTokenException();

        var user = await repository.GetUserAsync(presented.UserId, cancellationToken);
        if (user is null) throw new IdentityException.InvalidRefreshTokenException();

        var jwt = jwtFactory.Create(user);
        var raw = RefreshTokenSecret.Generate();
        presented.Revoke(now);
        repository.Add(RefreshToken.Issue(presented.UserId, presented.FamilyId, RefreshTokenSecret.Hash(raw), now));
        await repository.RemoveDeadAsync(presented.UserId, now, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return new SessionTokensDto(jwt, raw);
    }
}
