using AuctionServer.Modules.Inventory.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Inventory.Infrastructure.Configuration;

internal sealed class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicItemId).IsUnique();
        builder.HasIndex(x => x.LockedForAuctionId).IsUnique();
        builder.Property(x => x.OfficialPrice).IsRequired().HasPrecision(18, 2);
        builder.ToTable("InventoryItems");
    }
}