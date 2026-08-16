using System.IdentityModel.Tokens.Jwt;
using AuctionServer.Modules.Identity.Application.Commands.Login;
using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Modules.Identity.Infrastructure.Outbox;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class LoginCommandHandlerTests
{
    private const string Password = "Password123!";

    private sealed class FakeAuthRepository(User? user) : IAuthRepository
    {
        public Task<User?> GetUserByEmailAsync(string email, CancellationToken token) =>
            Task.FromResult(user?.Email == email ? user : null);

        public Task<bool> DoesUserWithThisEmailExists(string email, CancellationToken token) =>
            Task.FromResult(user?.Email == email);

        public Task AddUserWithOutboxAsync(User newUser, OutboxMessage message, CancellationToken token) =>
            Task.CompletedTask;
    }

    private static User CreateUser(string email = "user@test.com") =>
        new(email, BCrypt.Net.BCrypt.HashPassword(Password), "username", "Jan", "Kowalski", new DateOnly(2000, 1, 1));

    private static IConfiguration CreateConfiguration(string jwtKey = "unit-tests-signing-key-1234567890-abc") =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = jwtKey,
            ["Jwt:Issuer"] = "AuctionServer",
            ["Jwt:Audience"] = "AuctionServer.Client"
        }).Build();

    [Fact]
    public async Task Handle_WhenCredentialsAreValid_ShouldReturnTokenWithUserClaims()
    {
        var user = CreateUser();
        var handler = new LoginCommandHandler(new FakeAuthRepository(user), CreateConfiguration());

        var tokenString = await handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(tokenString);
        Assert.Contains(token.Claims, c => c.Value == user.PublicUserId.ToString());
        Assert.Equal("AuctionServer", token.Issuer);
        Assert.InRange(token.ValidTo, DateTime.UtcNow.AddMinutes(14), DateTime.UtcNow.AddMinutes(16));
    }

    [Fact]
    public async Task Handle_WhenUserDoesNotExist_ShouldThrowInvalidCredentials()
    {
        var handler = new LoginCommandHandler(new FakeAuthRepository(null), CreateConfiguration());

        await Assert.ThrowsAsync<IdentityException.InvalidCredentialsException>(
            () => handler.Handle(new LoginCommand("missing@test.com", Password), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenPasswordIsWrong_ShouldThrowInvalidCredentials()
    {
        var user = CreateUser();
        var handler = new LoginCommandHandler(new FakeAuthRepository(user), CreateConfiguration());

        await Assert.ThrowsAsync<IdentityException.InvalidCredentialsException>(
            () => handler.Handle(new LoginCommand(user.Email, "WrongPassword1!"), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WhenJwtKeyIsTooShort_ShouldThrowMissingConfiguration()
    {
        var user = CreateUser();
        var handler = new LoginCommandHandler(new FakeAuthRepository(user), CreateConfiguration(jwtKey: "too-short"));

        await Assert.ThrowsAsync<IdentityException.MissingConfigurationException>(
            () => handler.Handle(new LoginCommand(user.Email, Password), CancellationToken.None));
    }
}
