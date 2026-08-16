using AuctionServer.Modules.Inventory.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Infrastructure.Persistence;

public class InventoryDbContext(DbContextOptions<InventoryDbContext> options) : DbContext(options)
{
    public DbSet<Item> Items { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Item>().HasIndex(item => item.Id).IsUnique()
            .HasFilter("\"IsSoldToOfficialShop\" = false");
        modelBuilder.Entity<Item>().Property(i => i.Version).IsConcurrencyToken();
        
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}