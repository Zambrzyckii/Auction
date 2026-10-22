using AuctionServer.Modules.Profiles.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Profiles.Infrastructure.Configuration;

internal sealed class WarehouseInviteConfiguration : IEntityTypeConfiguration<WarehouseInvite>
{
    public void Configure(EntityTypeBuilder<WarehouseInvite> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.InviterId, x.InviteeId, x.PublicWarehouseId }).IsUnique();
        builder.HasIndex(x => x.InviteeId);
        builder.ToTable("ProfilesWarehouseInvites");
    }
}
