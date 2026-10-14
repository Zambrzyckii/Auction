using AuctionServer.Modules.Wallets.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Wallets.Infrastructure.Configuration;

internal sealed class TransferConfiguration : IEntityTypeConfiguration<Transfer>
{
    public void Configure(EntityTypeBuilder<Transfer> builder)
    {
        builder.ToTable("WalletsTransfers");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Amount).IsRequired().HasPrecision(18, 2);
        builder.HasIndex(x => x.SenderUserId);
        builder.HasIndex(x => x.RecipientUserId);
    }
}
