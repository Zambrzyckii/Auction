using System.Text.Json;
using AuctionServer.Modules.Identity.Application.Commands.Register;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Users;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(IdentityIntegrationCollection.Name)]
public class RegisterCommandHandlerTests(IdentityPostgresFixture fixture)
{
    private const string Password = "Password123!";

    private static RegisterCommand CreateCommand(string email) =>
        new(email, Password, "player-one", "Jan", "Kowalski", new DateOnly(2000, 1, 1));

    private async Task HandleAsync(RegisterCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new RegisterCommandHandler(new AuthRepository(context));
        await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenEmailIsFree_ShouldPersistUserAndOutboxRowWithUsername()
    {
        var email = IdentityPostgresFixture.UniqueEmail();

        await HandleAsync(CreateCommand(email));

        await using var context = fixture.CreateContext();
        var user = await context.Users.SingleAsync(u => u.Email == email);
        Assert.Equal(Role.User, user.UserRoles);
        Assert.Equal("player-one", user.Username);

        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(UserRegisteredEvent) && m.Content.Contains(user.PublicUserId.ToString()));
        var registeredEvent = JsonSerializer.Deserialize<UserRegisteredEvent>(outboxMessage.Content);
        Assert.NotNull(registeredEvent);
        Assert.Equal(user.PublicUserId, registeredEvent.PublicUserId);
        Assert.Equal(outboxMessage.Id, registeredEvent.EventId);
        Assert.Equal("player-one", registeredEvent.Username);
    }

    [Fact]
    public async Task Handle_WhenEmailIsTaken_ShouldThrowEmailAlreadyTakenAndPersistNothing()
    {
        var email = IdentityPostgresFixture.UniqueEmail();
        await fixture.SeedUserAsync(email);

        await Assert.ThrowsAsync<IdentityException.EmailAlreadyTakenException>(() => HandleAsync(CreateCommand(email)));

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.Users.CountAsync(u => u.Email == email));
    }
}
