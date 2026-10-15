using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Infrastructure.Inbox;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;

public sealed class PawnshopDbContext(DbContextOptions<PawnshopDbContext> options) : DbContext(options)
{
    public DbSet<Shop> Shops => Set<Shop>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<ProcessedMessage> ProcessedMessages => Set<ProcessedMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}
