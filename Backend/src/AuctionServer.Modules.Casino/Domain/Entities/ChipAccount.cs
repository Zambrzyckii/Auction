using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Domain.Entities;

public sealed class ChipAccount
{
    public int Id { get; init; }
    public Guid UserId { get; init; }
    public decimal Balance { get; private set; }
    public decimal LifetimeBought { get; private set; }
    public decimal LifetimeCashedOut { get; private set; }
    public DateTime CreatedOn { get; init; } = DateTime.UtcNow;
    public Guid Version { get; private set; } = Guid.NewGuid();

    public static ChipAccount Open(Guid userId, DateTime now) => new() { UserId = userId, CreatedOn = now };

    public void ReceivePurchase(decimal amount)
    {
        if (amount <= 0) throw new CasinoExceptions.InvalidChipAmountException();

        Balance += amount;
        LifetimeBought += amount;
        Version = Guid.NewGuid();
    }

    public void CashOut(decimal amount)
    {
        if (amount <= 0 || decimal.Round(amount, 2) != amount) throw new CasinoExceptions.InvalidChipAmountException();
        if (amount > Balance) throw new CasinoExceptions.InsufficientChipsException();

        Balance -= amount;
        LifetimeCashedOut += amount;
        Version = Guid.NewGuid();
    }
}
