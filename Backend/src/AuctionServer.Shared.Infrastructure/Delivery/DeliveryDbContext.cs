using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public class DeliveryDbContext(DbContextOptions<DeliveryDbContext> options) : DbContext(options)
{
    public DbSet<DeliveryMessage> DeliveryMessages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        DeliveryMessageModel.Configure(modelBuilder.Entity<DeliveryMessage>(), "DeliveryMessages");
    }
}
