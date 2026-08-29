using System.Text.Json;
using AuctionServer.Modules.Identity.Application.Commands.RegisterBot;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(IdentityIntegrationCollection.Name)]
public class RegisterBotCommandHandlerTests(IdentityPostgresFixture fixture)
{
    private const string Password = "Password123!";

    private static RegisterBotCommand CreateCommand(string email) =>
        new(email, Password, "bot-one", "Bot", "One", new DateOnly(2000, 1, 1));

    private async Task<Guid> HandleAsync(RegisterBotCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new RegisterBotCommandHandler(new AuthRepository(context));
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenEmailIsFree_ShouldPersistBotUserAndOutboxRow()
    {
        var email = IdentityPostgresFixture.UniqueEmail();

        var id = await HandleAsync(CreateCommand(email));

        await using var context = fixture.CreateContext();
        var user = await context.Users.SingleAsync(u => u.PublicUserId == id);
        Assert.Equal(Role.Bot, user.UserRoles);
        Assert.Equal(email, user.Email);
        Assert.True(BCrypt.Net.BCrypt.Verify(Password, user.PasswordHash));

        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(UserRegisteredEvent) && m.Content.Contains(id.ToString()));
        var registeredEvent = JsonSerializer.Deserialize<UserRegisteredEvent>(outboxMessage.Content);
        Assert.NotNull(registeredEvent);
        Assert.Equal(id, registeredEvent.PublicUserId);
        Assert.Equal(outboxMessage.Id, registeredEvent.EventId);
    }

    [Fact]
    public async Task Handle_WhenEmailIsTaken_ShouldThrowInvalidCredentialsAndPersistNothing()
    {
        var email = IdentityPostgresFixture.UniqueEmail();
        await fixture.SeedUserAsync(email);

        await Assert.ThrowsAsync<IdentityException.InvalidCredentialsException>(() => HandleAsync(CreateCommand(email)));

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.Users.CountAsync(u => u.Email == email));
    }
}
