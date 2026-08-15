using System.Text.Json;
using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Register;

public class RegisterCommandHandler(IAuthRepository repository) : IRequestHandler<RegisterCommand>
{
    public async Task Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var isEmailTaken = await repository.DoesUserWithThisEmailExists(request.Email, cancellationToken);
        if (isEmailTaken) throw new IdentityException.InvalidCredentialsException("This email is taken");

        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var newUser = new User(request.Email, hashedPassword, request.Username, request.Name, request.Surname, request.Birthday);

        var registeredEvent = new UserRegisteredEvent(newUser.PublicUserId, newUser.Email);
        var outboxMessage = new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = nameof(UserRegisteredEvent),
            Content = JsonSerializer.Serialize(registeredEvent)
        };
        await repository.AddUserWithOutboxAsync(newUser, outboxMessage, cancellationToken);
    }
}