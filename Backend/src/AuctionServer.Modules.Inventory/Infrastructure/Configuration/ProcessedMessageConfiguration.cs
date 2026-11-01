using AuctionServer.Shared.Infrastructure.Inbox;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Inventory.Infrastructure.Configuration;

internal sealed class ProcessedMessageConfiguration : IEntityTypeConfiguration<ProcessedMessage>
{
    public void Configure(EntityTypeBuilder<ProcessedMessage> builder) =>
        ProcessedMessageModel.Configure(builder, "InventoryProcessedMessages");
}
