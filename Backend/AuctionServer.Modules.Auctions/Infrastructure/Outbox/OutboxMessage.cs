namespace AuctionServer.Modules.Auctions.Infrastructure.Outbox;

public sealed class OutboxMessage
{
    public Guid Id { get; init; }
    public required string Type { get; init; }
    public required string Content { get; init; }
    public DateTime? ProcessedOn { get; private set; }

    public void MarkAsProcessed() => ProcessedOn = DateTime.UtcNow;
}