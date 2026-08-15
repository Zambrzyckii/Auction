using AuctionServer.Modules.Wallets.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Infrastructure.Persistence;

public class WalletDbContext(DbContextOptions<WalletDbContext> options) : DbContext(options)
{
    public DbSet<Wallet> Wallets { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Wallet>().HasIndex(wallet => wallet.UserId).IsUnique()
            .HasFilter("\"IsSuspendedWallet\" = false");
        modelBuilder.Entity<Wallet>().Property(w => w.Version).IsConcurrencyToken();
        
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}