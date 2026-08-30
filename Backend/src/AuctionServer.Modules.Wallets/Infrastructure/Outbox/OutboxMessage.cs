namespace AuctionServer.Modules.Wallets.Infrastructure.Outbox;

public sealed class OutboxMessage
{
    public Guid Id { get; init; }
    public required string Type { get; init; }
    public required string Content { get; init; }
    public DateTime CreatedOn { get; init; } = DateTime.UtcNow;
    public DateTime? ProcessedOn { get; private set; }
    public int AttemptCount { get; private set; } = 1;
    public List<string?> Errors { get; private set; } = new List<string?>();
    public bool IsDead { get; private set; }
    public DateTime? NextAttemptOn { get; private set; } = null;


    public void MarkAsProcessed() => ProcessedOn = DateTime.UtcNow;

    public void FailedAttempt(string errorMessage)
    {
        AttemptCount++;
        Errors.Add(errorMessage);
        NextAttemptOn = DateTime.UtcNow.AddSeconds(Math.Pow(2, AttemptCount) * 5);
    }

    public void MarkMessageAsDead() => IsDead = true;
}