using AuctionServer.Modules.Wallets.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Wallets.Infrastructure.Configuration;

internal sealed class WalletConfiguration : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> builder)
    {
        builder.HasKey(x => x.UserId);
        builder.HasIndex(x => x.UserId).IsUnique();
        builder.Property(x => x.AvailableFunds).IsRequired().HasPrecision(18, 2);
        builder.Property(x => x.LockedFunds).IsRequired().HasPrecision(18, 2);
    }
}