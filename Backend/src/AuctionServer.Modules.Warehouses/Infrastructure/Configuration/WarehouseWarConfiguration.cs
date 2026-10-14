using AuctionServer.Modules.Warehouses.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Warehouses.Infrastructure.Configuration;

internal sealed class WarehouseWarConfiguration : IEntityTypeConfiguration<WarehouseWar>
{
    public void Configure(EntityTypeBuilder<WarehouseWar> builder)
    {
        builder.ToTable("WarehousesWars");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicWarehouseId).IsUnique();
        builder.Property(x => x.Tier).IsRequired().HasMaxLength(32);
        builder.Property(x => x.TotalValue).HasPrecision(18, 2);
        builder.Property(x => x.EstimateMin).HasPrecision(18, 2);
        builder.Property(x => x.EstimateMax).HasPrecision(18, 2);
        builder.Property(x => x.EntryFee).HasPrecision(18, 2);
        builder.Property(x => x.CurrentPrice).HasPrecision(18, 2);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.OwnsMany(x => x.Participants, participant =>
        {
            participant.ToTable("WarehousesParticipants");
            participant.WithOwner().HasForeignKey("WarehouseWarId");
            participant.HasKey(x => x.Id);
            participant.HasIndex("WarehouseWarId", nameof(WarehouseParticipant.UserId)).IsUnique();
        });
        builder.Navigation(x => x.Participants).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
