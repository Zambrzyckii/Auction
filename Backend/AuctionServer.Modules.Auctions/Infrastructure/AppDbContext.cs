using AuctionServer.Modules.Auctions.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Auction> Auctions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Auction>().HasIndex(auction => auction.AuctionId).IsUnique()
            .HasFilter("\"IsClosed\" = false");
    }
}