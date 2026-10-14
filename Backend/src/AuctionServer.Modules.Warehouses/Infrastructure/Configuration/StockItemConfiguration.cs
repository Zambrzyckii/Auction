using AuctionServer.Modules.Warehouses.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Warehouses.Infrastructure.Configuration;

internal sealed class StockItemConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> builder)
    {
        builder.ToTable("WarehousesStockItems");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicWarehouseId);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Rarity).IsRequired().HasMaxLength(16);
        builder.Property(x => x.Price).HasPrecision(18, 2);
    }
}
