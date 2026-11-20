using AuctionServer.Modules.Identity.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Identity.Application.Queries.GetUserIdByEmail;

public class GetUserIdByEmailQueryHandler(IAuthRepository repository) : IRequestHandler<GetUserIdByEmailQuery, Guid?>
{
    public async Task<Guid?> Handle(GetUserIdByEmailQuery request, CancellationToken cancellationToken)
    {
        var user = await repository.GetUserByEmailAsync(request.Email, cancellationToken);
        return user?.PublicUserId;
    }
}
