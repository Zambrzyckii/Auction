using AuctionServer.Modules.Casino.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Casino.Infrastructure.Configuration;

internal sealed class BlackjackHandConfiguration : IEntityTypeConfiguration<BlackjackHand>
{
    public void Configure(EntityTypeBuilder<BlackjackHand> builder)
    {
        builder.ToTable("CasinoBlackjackHands");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicHandId).IsUnique();
        builder.HasIndex(x => x.UserId).IsUnique().HasFilter("\"Status\" = 0");
        builder.HasIndex(x => new { x.Status, x.LastActionOn });
        builder.HasIndex(x => new { x.UserId, x.StartedOn });
        builder.Property(x => x.Stake).HasPrecision(18, 2);
        builder.Property(x => x.Payout).HasPrecision(18, 2);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.Ignore(x => x.VisibleDealerCards);
    }
}
