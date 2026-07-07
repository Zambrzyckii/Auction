using AuctionServer.Modules.Auctions.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Auctions.Infrastructure.Configurations;

internal sealed class AuctionConfiguration : IEntityTypeConfiguration<Auction>
{
    public void Configure(EntityTypeBuilder<Auction> builder)
    {
        builder.HasKey(x => x.PublicAuctionId);
        builder.Property(x => x.CurrentPrice).IsRequired().HasPrecision(18, 2);
        builder.HasIndex(x => x.AuctionId).IsUnique();
    }
}