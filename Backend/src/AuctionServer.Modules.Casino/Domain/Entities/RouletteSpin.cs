using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Domain.Entities;

public sealed class RouletteSpin
{
    public long Id { get; init; }
    public Guid PublicSpinId { get; init; } = Guid.NewGuid();
    public Guid UserId { get; init; }
    public short Pocket { get; private set; }
    public decimal TotalStake { get; private set; }
    public decimal TotalPayout { get; private set; }
    public DateTime PlacedOn { get; init; }
    private readonly List<RouletteBet> _bets = [];
    public IReadOnlyCollection<RouletteBet> Bets => _bets;

    public static string ColorOf(int pocket) =>
        pocket == 0 ? "Green" : RouletteBet.RedPockets.Contains((short)pocket) ? "Red" : "Black";

    public static RouletteSpin Resolve(Guid userId, IReadOnlyList<RouletteBet> bets, int pocket,
        decimal minBet, decimal maxBet, int maxBetsPerSpin, DateTime now)
    {
        if (pocket is < 0 or > 36) throw new ArgumentOutOfRangeException(nameof(pocket));
        if (bets.Count < 1 || bets.Count > maxBetsPerSpin)
            throw new CasinoExceptions.InvalidRouletteBetsException($"A spin takes between 1 and {maxBetsPerSpin} bets");

        foreach (var bet in bets)
        {
            if (!bet.HasValidSelection)
                throw new CasinoExceptions.InvalidRouletteBetsException("Bet selection does not match its type");
            if (bet.Stake < minBet || bet.Stake > maxBet || bet.Stake != decimal.Truncate(bet.Stake))
                throw new CasinoExceptions.InvalidRouletteBetsException(
                    "Each stake must be a whole number of chips within the table limits");
        }

        var spin = new RouletteSpin { UserId = userId, PlacedOn = now, Pocket = (short)pocket };
        foreach (var bet in bets)
        {
            bet.Settle(pocket);
            spin._bets.Add(bet);
        }

        spin.TotalStake = bets.Sum(b => b.Stake);
        spin.TotalPayout = bets.Sum(b => b.Payout);
        return spin;
    }
}
