using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Infrastructure.Inbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Infrastructure.Persistence;

public sealed class ProfilesDbContext(DbContextOptions<ProfilesDbContext> options) : DbContext(options)
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<ProcessedMessage> ProcessedMessages => Set<ProcessedMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}
