using AuctionServer.Modules.Identity.Domain;
using AuctionServer.Modules.Identity.Domain.Entities;

namespace AuctionServer.Modules.Identity.Application.Interfaces;

public interface IAuthRepository
{
    public Task<User?> GetUserByEmailAsync(string email);
    public Task AddUserAsync(User user);
    public Task<bool> DoesUserWithThisEmailExists(string email);
}