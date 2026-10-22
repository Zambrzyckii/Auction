using System.Text.Json;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Modules.Wallets.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Players;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Infrastructure.Persistence;

public class WalletDbContext(DbContextOptions<WalletDbContext> options) : DbContext(options)
{
    public DbSet<Wallet> Wallets { get; set; }
    public DbSet<Transfer> Transfers { get; set; }
    public DbSet<OutboxMessage> OutboxMessages { get; set; }
    public DbSet<ProcessedMessage> ProcessedMessages { get; set; }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<Wallet>())
        {
            foreach (var levelUp in entry.Entity.TakePendingLevelUps())
            {
                var eventId = Guid.NewGuid();
                OutboxMessages.Add(new OutboxMessage
                {
                    Id = eventId,
                    Type = nameof(PlayerLevelledUpEvent),
                    Content = JsonSerializer.Serialize(new PlayerLevelledUpEvent(
                        eventId, entry.Entity.UserId, levelUp.FromLevel, levelUp.ToLevel, levelUp.Reward))
                });
            }
        }
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Wallet>().HasIndex(wallet => wallet.UserId).IsUnique()
            .HasFilter("\"IsSuspendedWallet\" = false");
        modelBuilder.Entity<Wallet>().Property(w => w.Version).IsConcurrencyToken();
        
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}