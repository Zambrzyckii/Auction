using AuctionServer.Modules.Pawnshop.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Pawnshop.Infrastructure.Configuration;

internal sealed class ShopConfiguration : IEntityTypeConfiguration<Shop>
{
    public void Configure(EntityTypeBuilder<Shop> builder)
    {
        builder.ToTable("PawnshopShops");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicPawnshopId).IsUnique();
        builder.HasIndex(x => x.UserId).IsUnique().HasFilter("\"Status\" IN (0, 1)");
        builder.Property(x => x.RejectionReason).HasMaxLength(256);
        builder.Property(x => x.Version).IsConcurrencyToken();
    }
}
