using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Infrastructure.Persistence;

public class AuctionDbContext(DbContextOptions<AuctionDbContext> options) : DbContext(options)
{
    public DbSet<Auction> Auctions { get; set; }
    public DbSet<OutboxMessage> OutboxMessages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Auction>().HasIndex(auction => auction.AuctionId).IsUnique()
            .HasFilter("\"IsClosed\" = false");
    }
}