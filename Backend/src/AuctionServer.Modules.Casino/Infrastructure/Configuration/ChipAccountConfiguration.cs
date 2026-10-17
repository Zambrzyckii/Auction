using AuctionServer.Modules.Casino.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Casino.Infrastructure.Configuration;

internal sealed class ChipAccountConfiguration : IEntityTypeConfiguration<ChipAccount>
{
    public void Configure(EntityTypeBuilder<ChipAccount> builder)
    {
        builder.ToTable("CasinoAccounts");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.UserId).IsUnique();
        builder.Property(x => x.Balance).HasPrecision(18, 2);
        builder.Property(x => x.LifetimeBought).HasPrecision(18, 2);
        builder.Property(x => x.LifetimeCashedOut).HasPrecision(18, 2);
        builder.Property(x => x.Version).IsConcurrencyToken();
    }
}
