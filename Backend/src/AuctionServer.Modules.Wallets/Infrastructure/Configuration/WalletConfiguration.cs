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
        builder.Property(x => x.LifetimeTurnover).IsRequired().HasPrecision(18, 2);
        builder.OwnsMany(x => x.FundsLocks, fundsLock =>
        {
            fundsLock.ToTable("WalletsFundsLocks");
            fundsLock.WithOwner().HasForeignKey("WalletUserId");
            fundsLock.HasKey(x => x.Id);
            fundsLock.Property(x => x.Amount).IsRequired().HasPrecision(18, 2);
            fundsLock.HasIndex("WalletUserId", nameof(FundsLock.PublicAuctionId))
                .IsUnique()
                .HasFilter("\"Status\" = 0");
        });
        builder.Navigation(x => x.FundsLocks).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}