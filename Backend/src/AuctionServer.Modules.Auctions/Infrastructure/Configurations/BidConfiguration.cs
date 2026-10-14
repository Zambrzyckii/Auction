using AuctionServer.Modules.Auctions.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Auctions.Infrastructure.Configurations;

internal sealed class BidConfiguration : IEntityTypeConfiguration<Bid>
{
    public void Configure(EntityTypeBuilder<Bid> builder)
    {
        builder.ToTable("AuctionsBids");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Amount).IsRequired().HasPrecision(18, 2);
        builder.HasIndex(x => x.PublicAuctionId);
    }
}
