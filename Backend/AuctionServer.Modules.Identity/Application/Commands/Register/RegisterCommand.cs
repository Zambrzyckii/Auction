using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.Register;

public record RegisterCommand(string Email, string Password, string Username, string Name, string Surname, DateOnly Birthday) : IRequest;