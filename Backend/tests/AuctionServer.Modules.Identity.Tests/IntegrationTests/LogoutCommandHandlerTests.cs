using AuctionServer.Modules.Identity.Application.Commands.Logout;
using AuctionServer.Modules.Identity.Application.Commands.RefreshSession;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(IdentityIntegrationCollection.Name)]
public class LogoutCommandHandlerTests(IdentityPostgresFixture fixture)
{
    private static readonly JwtTokenFactory JwtFactory = new(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "integration-tests-signing-key-1234567890",
            ["Jwt:Issuer"] = "AuctionServer",
            ["Jwt:Audience"] = "AuctionServer.Client"
        }).Build());

    private async Task LogoutAsync(string raw)
    {
        await using var context = fixture.CreateContext();
        var handler = new LogoutCommandHandler(new RefreshTokenRepository(context));
        await handler.Handle(new LogoutCommand(raw), CancellationToken.None);
    }

    private async Task<SessionTokensDto> RotateAsync(string raw)
    {
        await using var context = fixture.CreateContext();
        var handler = new RefreshSessionCommandHandler(new RefreshTokenRepository(context), JwtFactory);
        return await handler.Handle(new RefreshSessionCommand(raw), CancellationToken.None);
    }

    private async Task<DateTime?> RevokedOnAsync(Guid id)
    {
        await using var context = fixture.CreateContext();
        return (await context.RefreshTokens.SingleAsync(t => t.Id == id)).RevokedOn;
    }

    [Fact]
    public async Task Handle_WhenTokenIsActive_ShouldRevokeOnlyThatToken()
    {
        var user = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());
        var (tokenA, rawA) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));
        var (tokenB, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));

        await LogoutAsync(rawA);

        Assert.NotNull(await RevokedOnAsync(tokenA.Id));
        Assert.Null(await RevokedOnAsync(tokenB.Id));
    }

    [Fact]
    public async Task Handle_WhenTokenIsUnknown_ShouldReturnWithoutChanges()
    {
        var user = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());
        var (token, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));

        await LogoutAsync(RefreshTokenSecret.Generate());

        Assert.Null(await RevokedOnAsync(token.Id));
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.RefreshTokens.CountAsync(t => t.UserId == user.Id));
    }

    [Fact]
    public async Task Handle_WhenTokenIsAlreadyRevoked_ShouldKeepTheFirstRevocationAndTheFamily()
    {
        var user = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());
        var (tokenA, rawA) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));
        var rotated = await RotateAsync(rawA);
        var firstRevocation = await RevokedOnAsync(tokenA.Id);

        await LogoutAsync(rawA);

        Assert.Equal(firstRevocation, await RevokedOnAsync(tokenA.Id));
        await using var context = fixture.CreateContext();
        var successor = await context.RefreshTokens.SingleAsync(t => t.TokenHash == RefreshTokenSecret.Hash(rotated.RefreshToken!));
        Assert.Null(successor.RevokedOn);
    }
}
