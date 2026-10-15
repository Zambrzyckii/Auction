using AuctionServer.Modules.Pawnshop.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Configuration;

internal sealed class StockItemConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> builder)
    {
        builder.ToTable("PawnshopStockItems");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicStockItemId).IsUnique();
        builder.HasIndex(x => new { x.Status, x.SellAfter });
        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Price).HasPrecision(18, 2);
        builder.Property(x => x.PayoutRate).HasPrecision(5, 4);
        builder.Property(x => x.PayoutAmount).HasPrecision(18, 2);
        builder.Property(x => x.Version).IsConcurrencyToken();
    }
}
