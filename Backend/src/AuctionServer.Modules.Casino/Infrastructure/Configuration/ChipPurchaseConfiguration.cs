using AuctionServer.Modules.Casino.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Casino.Infrastructure.Configuration;

internal sealed class ChipPurchaseConfiguration : IEntityTypeConfiguration<ChipPurchase>
{
    public void Configure(EntityTypeBuilder<ChipPurchase> builder)
    {
        builder.ToTable("CasinoChipPurchases");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicPurchaseId).IsUnique();
        builder.HasIndex(x => x.UserId).IsUnique().HasFilter("\"Status\" = 0");
        builder.HasIndex(x => new { x.Status, x.RequestedOn });
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.RejectionReason).HasMaxLength(256);
        builder.Property(x => x.Version).IsConcurrencyToken();
    }
}
