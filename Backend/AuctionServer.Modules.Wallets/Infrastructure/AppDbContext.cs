using AuctionServer.Modules.Wallets.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Wallet> Wallets { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Wallet>().HasIndex(wallet => wallet.UserId).IsUnique()
            .HasFilter("\"IsSuspendedWallet\" = false");
    }
}