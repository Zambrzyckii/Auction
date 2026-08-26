using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Infrastructure.Persistence;

public class InventoryDbContext(DbContextOptions<InventoryDbContext> options) : DbContext(options)
{
    public DbSet<Item> Items { get; set; }
    public DbSet<OutboxMessage> OutboxMessages { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Item>().Property(i => i.Version).IsConcurrencyToken();
        
        modelBuilder.ApplyConfigurationsFromAssembly(GetType().Assembly);
    }
}