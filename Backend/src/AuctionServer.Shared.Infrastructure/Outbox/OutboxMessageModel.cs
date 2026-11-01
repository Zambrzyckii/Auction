using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Shared.Infrastructure.Outbox;

public static class OutboxMessageModel
{
    public static void Configure(EntityTypeBuilder<OutboxMessage> builder, string tableName)
    {
        builder.ToTable(tableName);
        builder.HasIndex(m => m.CreatedOn)
            .HasFilter("\"ProcessedOn\" IS NULL AND NOT \"IsDead\"")
            .HasDatabaseName($"IX_{tableName}_Pending");
    }
}
