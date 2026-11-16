using System.IdentityModel.Tokens.Jwt;
using AuctionServer.Modules.Identity.Application.Commands.Login;
using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class LoginCommandHandlerTests
{
    private const string Password = "Password123!";
    private const string JwtKey = "unit-tests-signing-key-1234567890-abc";

    private sealed class FakeAuthRepository(User? user) : IAuthRepository
    {
        public Task<User?> GetUserByEmailAsync(string email, CancellationToken token) =>
            Task.FromResult(user?.Email == email ? user : null);

        public Task<bool> DoesUserWithThisEmailExists(string email, CancellationToken token) =>
            Task.FromResult(user?.Email == email);

        public Task<bool> DoesUserWithThisUsernameExists(string username, CancellationToken token) =>
            Task.FromResult(user?.Username == username);

        public Task AddUserWithOutboxAsync(User newUser, OutboxMessage message, CancellationToken token) =>
            Task.CompletedTask;
    }

    private static User CreateUser(string email = "user@test.com") =>
        new(email, BCrypt.Net.BCrypt.HashPassword(Password), "username", "Jan", "Kowalski", new DateOnly(2000, 1, 1));

    private static IConfiguration CreateConfiguration(string jwtKey) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = jwtKey,
            ["Jwt:Issuer"] = "AuctionServer",
            ["Jwt:Audience"] = "AuctionServer.Client"
        }).Build();

    private static LoginCommandHandler CreateHandler(
        User? user, FakeRefreshTokenRepository? store = null, string jwtKey = JwtKey) =>
        new(new FakeAuthRepository(user), store ?? new FakeRefreshTokenRepository(),
            new JwtTokenFactory(CreateConfiguration(jwtKey)));

    [Fact]
    public async Task Handle_WhenCredentialsAreValid_ShouldReturnTokenWithUserClaims()
    {
        var user = CreateUser();
        var handler = CreateHandler(user);

        var result = await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        Assert.Contains(token.Claims, c => c.Value == user.PublicUserId.ToString());
        Assert.Equal("AuctionServer", token.Issuer);
        Assert.InRange(token.ValidTo, DateTime.UtcNow.AddMinutes(14), DateTime.UtcNow.AddMinutes(16));
    }

    [Fact]
    public async Task Handle_WhenUserIsBot_ShouldReturnTokenValidForTwentyFourHours()
    {
        var user = CreateUser();
        user.ChangeRole(Role.Bot);
        var handler = CreateHandler(user);

        var result = await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        Assert.Contains(token.Claims, c => c.Value == nameof(Role.Bot));
        Assert.InRange(token.ValidTo, DateTime.UtcNow.AddHours(24).AddMinutes(-1), DateTime.UtcNow.AddHours(24).AddMinutes(1));
    }

    [Fact]
    public async Task Handle_WhenUserDoesNotExist_ShouldThrowInvalidCredentials()
    {
        var handler = CreateHandler(null);

        await Assert.ThrowsAsync<IdentityException.InvalidCredentialsException>(
            () => handler.Handle(new LoginCommand("missing@test.com", Password), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenPasswordIsWrong_ShouldThrowInvalidCredentials()
    {
        var user = CreateUser();
        var handler = CreateHandler(user);

        await Assert.ThrowsAsync<IdentityException.InvalidCredentialsException>(
            () => handler.Handle(new LoginCommand(user.Email, "WrongPassword1!"), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenJwtKeyIsTooShort_ShouldThrowMissingConfiguration()
    {
        var user = CreateUser();
        var store = new FakeRefreshTokenRepository();
        var handler = CreateHandler(user, store, jwtKey: "too-short");

        await Assert.ThrowsAsync<IdentityException.MissingConfigurationException>(
            () => handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None));

        Assert.Empty(store.Added);
        Assert.Equal(0, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenUserIsPlayer_ShouldReturnRefreshTokenAndStoreOnlyItsHash()
    {
        var user = CreateUser();
        var store = new FakeRefreshTokenRepository();
        var handler = CreateHandler(user, store);

        var result = await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);

        Assert.NotNull(result.RefreshToken);
        var stored = Assert.Single(store.Added);
        Assert.Equal(RefreshTokenSecret.Hash(result.RefreshToken), stored.TokenHash);
        Assert.NotEqual(result.RefreshToken, stored.TokenHash);
        Assert.Equal(user.Id, stored.UserId);
        Assert.InRange(stored.ExpiresOn, DateTime.UtcNow.AddDays(7).AddMinutes(-1), DateTime.UtcNow.AddDays(7).AddMinutes(1));
        Assert.Equal(1, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenUserIsBot_ShouldReturnNoRefreshTokenAndStoreNothing()
    {
        var user = CreateUser();
        user.ChangeRole(Role.Bot);
        var store = new FakeRefreshTokenRepository();
        var handler = CreateHandler(user, store);

        var result = await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);

        Assert.Null(result.RefreshToken);
        Assert.Empty(store.Added);
        Assert.Equal(0, store.SaveCount);
    }

    [Fact]
    public async Task Handle_WhenPlayerLogsInTwice_ShouldStartTwoFamilies()
    {
        var user = CreateUser();
        var store = new FakeRefreshTokenRepository();
        var handler = CreateHandler(user, store);

        await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);
        await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);

        Assert.Equal(2, store.Added.Count);
        Assert.NotEqual(store.Added[0].FamilyId, store.Added[1].FamilyId);
        Assert.All(store.Added, t => Assert.True(t.IsActive(DateTime.UtcNow)));
    }
}
