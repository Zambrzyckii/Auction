using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Login;

public sealed class LoginCommandHandler(
    IAuthRepository repository,
    IRefreshTokenRepository refreshTokens,
    JwtTokenFactory jwtFactory) : IRequestHandler<LoginCommand, SessionTokensDto>
{
    public async Task<SessionTokensDto> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await repository.GetUserByEmailAsync(request.Email, cancellationToken);
        if (user is null) throw new IdentityException.InvalidCredentialsException("Invalid credentials provided");

        var isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!isPasswordValid) throw new IdentityException.InvalidCredentialsException("Invalid credentials provided");

        var jwt = jwtFactory.Create(user);
        if (user.UserRoles == Role.Bot) return new SessionTokensDto(jwt, null);

        var raw = RefreshTokenSecret.Generate();
        refreshTokens.Add(RefreshToken.Issue(user.Id, Guid.NewGuid(), RefreshTokenSecret.Hash(raw), DateTime.UtcNow));
        await refreshTokens.SaveChangesAsync(cancellationToken);
        return new SessionTokensDto(jwt, raw);
    }
}
