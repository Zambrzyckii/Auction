using AuctionServer.Modules.Auctions.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Auctions.Infrastructure.Configurations;

internal sealed class AuctionConfiguration : IEntityTypeConfiguration<Auction>
{
    public void Configure(EntityTypeBuilder<Auction> builder)
    {
        builder.HasKey(x => x.AuctionId);
        builder.HasIndex(x => x.PublicAuctionId).IsUnique();
        builder.Property(x => x.CurrentPrice).IsRequired().HasPrecision(18, 2);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.HasIndex(x => x.ItemId).IsUnique().HasFilter("\"Status\" IN (0, 1)");
        builder.Property(x => x.ItemOfficialPrice).HasPrecision(18, 2);
    }
}