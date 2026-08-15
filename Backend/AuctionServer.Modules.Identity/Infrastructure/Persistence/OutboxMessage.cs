namespace AuctionServer.Modules.Identity.Infrastructure.Persistence;

public sealed class OutboxMessage
{
    public Guid Id { get; init; }
    public required string Type { get; init; }
    public required string Content { get; init; }
    public DateTime CreatedOn { get; init; } = DateTime.UtcNow;
    public DateTime? ProcessedOn { get; private set; }

    public void MarkAsProcessed() => ProcessedOn = DateTime.UtcNow;
}