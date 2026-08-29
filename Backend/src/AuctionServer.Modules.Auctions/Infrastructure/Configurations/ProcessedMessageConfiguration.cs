using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Auctions.Infrastructure.Configurations;

internal sealed class ProcessedMessageConfiguration : IEntityTypeConfiguration<ProcessedMessage>
{
    public void Configure(EntityTypeBuilder<ProcessedMessage> builder)
    {
        builder.HasKey(x => x.EventId);
        builder.ToTable("AuctionsProcessedMessages");
    }
}