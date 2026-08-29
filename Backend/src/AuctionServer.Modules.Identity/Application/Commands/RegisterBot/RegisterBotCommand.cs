using MediatR;

namespace AuctionServer.Modules.Identity.Application.Commands.RegisterBot;

public record RegisterBotCommand(string Email, string Password, string Username, string Name, string Surname, DateOnly Birthday) : IRequest<Guid>;