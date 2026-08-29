namespace AuctionServer.Modules.Inventory.Infrastructure.Inbox;

public sealed class ProcessedMessage
{
    public Guid EventId { get; init; }
    public DateTime ProcessedOn { get; init; } = DateTime.UtcNow;
}