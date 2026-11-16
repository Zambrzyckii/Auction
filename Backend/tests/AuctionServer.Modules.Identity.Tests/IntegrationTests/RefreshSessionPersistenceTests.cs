using AuctionServer.Modules.Identity.Application.Commands.RefreshSession;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(IdentityIntegrationCollection.Name)]
public class RefreshSessionPersistenceTests(IdentityPostgresFixture fixture)
{
    private static readonly JwtTokenFactory JwtFactory = new(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "integration-tests-signing-key-1234567890",
            ["Jwt:Issuer"] = "AuctionServer",
            ["Jwt:Audience"] = "AuctionServer.Client"
        }).Build());

    private async Task<SessionTokensDto> HandleAsync(string raw)
    {
        await using var context = fixture.CreateContext();
        var handler = new RefreshSessionCommandHandler(new RefreshTokenRepository(context), JwtFactory);
        return await handler.Handle(new RefreshSessionCommand(raw), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldPersistTheRotationWithoutTheRawValue()
    {
        var user = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());
        var (presented, raw) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));

        var result = await HandleAsync(raw);

        await using var context = fixture.CreateContext();
        Assert.False(await context.RefreshTokens.AnyAsync(t => t.TokenHash == result.RefreshToken));
        var successor = await context.RefreshTokens.SingleAsync(t => t.TokenHash == RefreshTokenSecret.Hash(result.RefreshToken!));
        Assert.Equal(presented.FamilyId, successor.FamilyId);
        Assert.NotNull((await context.RefreshTokens.SingleAsync(t => t.Id == presented.Id)).RevokedOn);
    }

    [Fact]
    public async Task Handle_WhenReuseIsDetected_ShouldRevokeTheSuccessorButNotOtherFamilies()
    {
        var user = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());
        var (_, rawA) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));
        var (tokenB, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));
        var rotated = await HandleAsync(rawA);

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(() => HandleAsync(rawA));

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(() => HandleAsync(rotated.RefreshToken!));
        await using var context = fixture.CreateContext();
        Assert.NotNull((await context.RefreshTokens.SingleAsync(t => t.TokenHash == RefreshTokenSecret.Hash(rotated.RefreshToken!))).RevokedOn);
        Assert.Null((await context.RefreshTokens.SingleAsync(t => t.Id == tokenB.Id)).RevokedOn);
    }

    [Fact]
    public async Task Handle_WhenRotating_ShouldSlideTheExpiryFromNow()
    {
        var user = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());
        var (_, raw) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), DateTime.UtcNow.AddDays(-6));

        var result = await HandleAsync(raw);

        await using var context = fixture.CreateContext();
        var successor = await context.RefreshTokens.SingleAsync(t => t.TokenHash == RefreshTokenSecret.Hash(result.RefreshToken!));
        Assert.InRange(successor.ExpiresOn, DateTime.UtcNow.AddDays(7).AddMinutes(-1), DateTime.UtcNow.AddDays(7).AddMinutes(1));
    }
}
