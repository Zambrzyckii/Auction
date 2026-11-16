using System.IdentityModel.Tokens.Jwt;
using AuctionServer.Modules.Identity.Application.Commands.RefreshSession;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class RefreshSessionCommandHandlerTests
{
    private const string JwtKey = "unit-tests-signing-key-1234567890-abc";
    private static readonly DateTime Now = DateTime.UtcNow;

    private static User CreateUser() =>
        new("user@test.com", "hash", "username", "Jan", "Kowalski", new DateOnly(2000, 1, 1));

    private static IConfiguration CreateConfiguration(string jwtKey) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = jwtKey,
            ["Jwt:Issuer"] = "AuctionServer",
            ["Jwt:Audience"] = "AuctionServer.Client"
        }).Build();

    private static RefreshSessionCommandHandler CreateHandler(FakeRefreshTokenRepository store, string jwtKey = JwtKey) =>
        new(store, new JwtTokenFactory(CreateConfiguration(jwtKey)));

    private static (FakeRefreshTokenRepository Store, RefreshToken Stored, string Raw) Seed(
        User? user, DateTime createdOn, DateTime? revokedOn = null)
    {
        var store = new FakeRefreshTokenRepository { User = user };
        var raw = RefreshTokenSecret.Generate();
        var stored = RefreshToken.Issue(user?.Id ?? 0, Guid.NewGuid(), RefreshTokenSecret.Hash(raw), createdOn);
        if (revokedOn is not null) stored.Revoke(revokedOn.Value);
        store.Stored.Add(stored);
        return (store, stored, raw);
    }

    [Fact]
    public async Task Handle_WhenTokenIsActive_ShouldRotateWithinTheFamily()
    {
        var user = CreateUser();
        var (store, stored, raw) = Seed(user, Now.AddDays(-1));

        var result = await CreateHandler(store).Handle(new RefreshSessionCommand(raw), CancellationToken.None);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        Assert.Contains(jwt.Claims, c => c.Type == "nameid" && c.Value == user.PublicUserId.ToString());
        Assert.NotNull(result.RefreshToken);
        Assert.NotEqual(raw, result.RefreshToken);
        Assert.NotNull(stored.RevokedOn);
        var successor = Assert.Single(store.Added);
        Assert.Equal(stored.FamilyId, successor.FamilyId);
        Assert.Equal(RefreshTokenSecret.Hash(result.RefreshToken), successor.TokenHash);
        Assert.InRange(successor.ExpiresOn, DateTime.UtcNow.AddDays(7).AddMinutes(-1), DateTime.UtcNow.AddDays(7).AddMinutes(1));
        Assert.NotNull(store.PurgedAt);
        Assert.Equal(1, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenTokenIsUnknown_ShouldThrowInvalidRefreshToken()
    {
        var store = new FakeRefreshTokenRepository { User = CreateUser() };

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(
            () => CreateHandler(store).Handle(new RefreshSessionCommand("unknown"), CancellationToken.None));

        Assert.Equal(0, store.SaveCount);
        Assert.Empty(store.RevokedFamilies);
    }

    [Fact]
    public async Task Handle_WhenRevokedTokenIsPresented_ShouldRevokeTheFamilyAndThrow()
    {
        var (store, stored, raw) = Seed(CreateUser(), Now.AddDays(-1), revokedOn: Now.AddHours(-1));

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(
            () => CreateHandler(store).Handle(new RefreshSessionCommand(raw), CancellationToken.None));

        Assert.Equal([stored.FamilyId], store.RevokedFamilies);
        Assert.Empty(store.Added);
        Assert.Equal(0, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenRevokedTokenHasAlsoExpired_ShouldStillRevokeTheFamily()
    {
        var (store, stored, raw) = Seed(CreateUser(), Now.AddDays(-10), revokedOn: Now.AddDays(-9));

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(
            () => CreateHandler(store).Handle(new RefreshSessionCommand(raw), CancellationToken.None));

        Assert.Equal([stored.FamilyId], store.RevokedFamilies);
    }

    [Fact]
    public async Task Handle_WhenTokenIsExpired_ShouldThrowWithoutRevokingTheFamily()
    {
        var (store, stored, raw) = Seed(CreateUser(), Now.AddDays(-8));

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(
            () => CreateHandler(store).Handle(new RefreshSessionCommand(raw), CancellationToken.None));

        Assert.Empty(store.RevokedFamilies);
        Assert.Null(stored.RevokedOn);
        Assert.Equal(0, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenOwnerNoLongerExists_ShouldThrowAndKeepTheTokenActive()
    {
        var (store, stored, raw) = Seed(CreateUser(), Now.AddDays(-1));
        store.User = null;

        await Assert.ThrowsAsync<IdentityException.InvalidRefreshTokenException>(
            () => CreateHandler(store).Handle(new RefreshSessionCommand(raw), CancellationToken.None));

        Assert.True(stored.IsActive(Now));
        Assert.Empty(store.Added);
        Assert.Equal(0, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenJwtKeyIsTooShort_ShouldLeaveThePresentedTokenActive()
    {
        var (store, stored, raw) = Seed(CreateUser(), Now.AddDays(-1));

        await Assert.ThrowsAsync<IdentityException.MissingConfigurationException>(
            () => CreateHandler(store, jwtKey: "too-short").Handle(new RefreshSessionCommand(raw), CancellationToken.None));

        Assert.True(stored.IsActive(Now));
        Assert.Empty(store.Added);
        Assert.Equal(0, store.SaveCount);
    }
}
