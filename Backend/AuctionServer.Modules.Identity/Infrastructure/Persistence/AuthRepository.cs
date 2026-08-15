using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Identity.Infrastructure.Persistence;

public class AuthRepository(IdentityDbContext context) : IAuthRepository
{
    public async Task<User?> GetUserByEmailAsync(string email, CancellationToken token)
    {
        return await context.Users.SingleOrDefaultAsync(u => u.Email == email, token);
    }

    public async Task<bool> DoesUserWithThisEmailExists(string email, CancellationToken token)
    {
        return await context.Users.AnyAsync(u => u.Email == email, token);
    }

    public async Task AddUserWithOutboxAsync(User user, OutboxMessage message, CancellationToken token)
    {
        context.Users.Add(user);
        context.OutboxMessages.Add(message);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e)
            when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new IdentityException.InvalidCredentialsException("This email is taken");
        }
    }
}