namespace AuctionServer.Modules.Wallets.Domain.Entities;

public class Transfer
{
    public int Id { get; init; }
    public Guid SenderUserId { get; init; }
    public Guid RecipientUserId { get; init; }
    public decimal Amount { get; init; }
    public DateTime SentOn { get; init; } = DateTime.UtcNow;
}
