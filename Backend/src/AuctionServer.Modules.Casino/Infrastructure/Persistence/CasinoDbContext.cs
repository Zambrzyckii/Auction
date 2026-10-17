using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Infrastructure.Inbox;
using AuctionServer.Modules.Casino.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Infrastructure.Persistence;

public sealed class CasinoDbContext(DbContextOptions<CasinoDbContext> options) : DbContext(options)
{
    public DbSet<ChipAccount> ChipAccounts => Set<ChipAccount>();
    public DbSet<ChipPurchase> ChipPurchases => Set<ChipPurchase>();
    public DbSet<RouletteSpin> RouletteSpins => Set<RouletteSpin>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<ProcessedMessage> ProcessedMessages => Set<ProcessedMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}
