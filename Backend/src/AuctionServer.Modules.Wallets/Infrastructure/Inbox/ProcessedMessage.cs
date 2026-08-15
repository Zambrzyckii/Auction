namespace AuctionServer.Modules.Wallets.Infrastructure.Inbox;

public sealed class ProcessedMessage
{
    public Guid EventId { get; init; }
    public DateTime ProcessedOn { get; init; } = DateTime.UtcNow;
}