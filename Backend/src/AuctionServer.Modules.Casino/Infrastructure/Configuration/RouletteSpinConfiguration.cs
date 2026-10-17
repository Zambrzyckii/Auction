using AuctionServer.Modules.Casino.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Casino.Infrastructure.Configuration;

internal sealed class RouletteSpinConfiguration : IEntityTypeConfiguration<RouletteSpin>
{
    public void Configure(EntityTypeBuilder<RouletteSpin> builder)
    {
        builder.ToTable("CasinoRouletteSpins");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicSpinId).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.PlacedOn });
        builder.Property(x => x.TotalStake).HasPrecision(18, 2);
        builder.Property(x => x.TotalPayout).HasPrecision(18, 2);
        builder.OwnsMany(x => x.Bets, bet =>
        {
            bet.ToTable("CasinoRouletteBets");
            bet.WithOwner().HasForeignKey("SpinId");
            bet.HasKey(x => x.Id);
            bet.Property(x => x.Stake).HasPrecision(18, 2);
            bet.Property(x => x.Payout).HasPrecision(18, 2);
        });
        builder.Navigation(x => x.Bets).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
