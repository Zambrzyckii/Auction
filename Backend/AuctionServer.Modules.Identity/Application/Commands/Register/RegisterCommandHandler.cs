using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Register;

public class RegisterCommandHandler(IAuthRepository repository, IPublisher publisher) : IRequestHandler<RegisterCommand>
{
    public async Task Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var isEmailTaken = await repository.DoesUserWithThisEmailExists(request.Email);
        if (isEmailTaken) throw new IdentityException.InvalidCredentialsException("This email is taken");

        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var newUser = new User(request.Email, hashedPassword, request.Username, request.Name, request.Surname, request.Birthday);

        await repository.AddUserAsync(newUser);

        var registeredEvent = new UserRegisteredEvent(newUser.PublicUserId, newUser.Email);
        await publisher.Publish(registeredEvent, cancellationToken);
    }
}