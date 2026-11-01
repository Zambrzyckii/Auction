using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public static class DeliveryMessageModel
{
    public static void Configure(EntityTypeBuilder<DeliveryMessage> builder, string tableName)
    {
        builder.ToTable(tableName);
        builder.HasKey(m => new { m.MessageId, m.Recipient });
        builder.HasIndex(m => new { m.CreatedOn, m.Position })
            .HasFilter("\"ProcessedOn\" IS NULL AND NOT \"IsDead\"")
            .HasDatabaseName($"IX_{tableName}_Pending");
    }
}
