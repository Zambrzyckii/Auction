using MediatR;

namespace AuctionServer.Modules.Identity.Application.Queries.GetUserIdByEmail;

public record GetUserIdByEmailQuery(string Email) : IRequest<Guid?>;
