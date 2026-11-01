using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Shared.Infrastructure.Inbox;

public static class ProcessedMessageModel
{
    public static void Configure(EntityTypeBuilder<ProcessedMessage> builder, string tableName)
    {
        builder.ToTable(tableName);
        builder.HasKey(m => m.EventId);
    }
}
