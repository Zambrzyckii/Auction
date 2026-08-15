using AuctionServer.Modules.Identity.Domain;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Infrastructure.Outbox;

namespace AuctionServer.Modules.Identity.Application.Interfaces;

public interface IAuthRepository
{
    public Task<User?> GetUserByEmailAsync(string email, CancellationToken token);
    public Task<bool> DoesUserWithThisEmailExists(string email, CancellationToken token);
    public Task AddUserWithOutboxAsync(User user, OutboxMessage message, CancellationToken token);
}