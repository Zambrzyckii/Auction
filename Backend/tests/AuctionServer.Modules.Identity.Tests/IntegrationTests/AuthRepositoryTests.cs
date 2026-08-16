using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Modules.Identity.Infrastructure.Outbox;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(IdentityIntegrationCollection.Name)]
public class AuthRepositoryTests(IdentityPostgresFixture fixture)
{
    private static User CreateUser(string email) =>
        new(email, "hash", "username", "Jan", "Kowalski", new DateOnly(2000, 1, 1));

    private static OutboxMessage CreateOutboxMessage() =>
        new() { Id = Guid.NewGuid(), Type = "UserRegisteredEvent", Content = "{}" };

    [Fact]
    public async Task AddUserWithOutboxAsync_ShouldPersistUserAndOutboxRowTogether()
    {
        var email = IdentityPostgresFixture.UniqueEmail();
        var message = CreateOutboxMessage();

        await using (var context = fixture.CreateContext())
        {
            var repository = new AuthRepository(context);
            await repository.AddUserWithOutboxAsync(CreateUser(email), message, CancellationToken.None);
        }

        await using var verifyContext = fixture.CreateContext();
        Assert.True(await verifyContext.Users.AnyAsync(u => u.Email == email));
        Assert.True(await verifyContext.OutboxMessages.AnyAsync(m => m.Id == message.Id));
    }

    [Fact]
    public async Task AddUserWithOutboxAsync_WhenEmailIsTaken_ShouldThrowAndPersistNothing()
    {
        var email = IdentityPostgresFixture.UniqueEmail();
        await fixture.SeedUserAsync(email);
        var message = CreateOutboxMessage();

        await using (var context = fixture.CreateContext())
        {
            var repository = new AuthRepository(context);
            await Assert.ThrowsAsync<IdentityException.InvalidCredentialsException>(
                () => repository.AddUserWithOutboxAsync(CreateUser(email), message, CancellationToken.None));
        }

        await using var verifyContext = fixture.CreateContext();
        Assert.Equal(1, await verifyContext.Users.CountAsync(u => u.Email == email));
        Assert.False(await verifyContext.OutboxMessages.AnyAsync(m => m.Id == message.Id));
    }

    [Fact]
    public async Task GetUserByEmailAsync_WhenUserExists_ShouldReturnUser()
    {
        var seeded = await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());

        await using var context = fixture.CreateContext();
        var repository = new AuthRepository(context);
        var user = await repository.GetUserByEmailAsync(seeded.Email, CancellationToken.None);

        Assert.NotNull(user);
        Assert.Equal(seeded.PublicUserId, user.PublicUserId);
    }

    [Fact]
    public async Task GetUserByEmailAsync_WhenUserDoesNotExist_ShouldReturnNull()
    {
        await using var context = fixture.CreateContext();
        var repository = new AuthRepository(context);

        var user = await repository.GetUserByEmailAsync(IdentityPostgresFixture.UniqueEmail(), CancellationToken.None);

        Assert.Null(user);
    }

    [Fact]
    public async Task GetUserByEmailAsync_WhenUserIsSoftDeleted_ShouldReturnNull()
    {
        var email = IdentityPostgresFixture.UniqueEmail();
        await using (var seedContext = fixture.CreateContext())
        {
            var user = CreateUser(email);
            user.DeleteThisUser();
            seedContext.Users.Add(user);
            await seedContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var repository = new AuthRepository(context);
        var found = await repository.GetUserByEmailAsync(email, CancellationToken.None);

        Assert.Null(found);
    }

    [Fact]
    public async Task DoesUserWithThisEmailExists_ShouldReflectDatabaseState()
    {
        var email = IdentityPostgresFixture.UniqueEmail();

        await using var context = fixture.CreateContext();
        var repository = new AuthRepository(context);
        Assert.False(await repository.DoesUserWithThisEmailExists(email, CancellationToken.None));

        await fixture.SeedUserAsync(email);
        Assert.True(await repository.DoesUserWithThisEmailExists(email, CancellationToken.None));
    }
}
