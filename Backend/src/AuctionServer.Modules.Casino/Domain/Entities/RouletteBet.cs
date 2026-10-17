using AuctionServer.Modules.Casino.Domain.Enums;

namespace AuctionServer.Modules.Casino.Domain.Entities;

public sealed class RouletteBet
{
    public long Id { get; init; }
    public RouletteBetType Type { get; init; }
    public short? Selection { get; init; }
    public decimal Stake { get; init; }
    public decimal Payout { get; private set; }

    public static readonly IReadOnlySet<short> RedPockets =
        new HashSet<short> { 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36 };

    public bool HasValidSelection => Type switch
    {
        RouletteBetType.Straight => Selection is >= 0 and <= 36,
        RouletteBetType.Dozen or RouletteBetType.Column => Selection is >= 1 and <= 3,
        _ => Selection is null
    };

    public int CoverCount => Type switch
    {
        RouletteBetType.Straight => 1,
        RouletteBetType.Dozen or RouletteBetType.Column => 12,
        _ => 18
    };

    public bool Covers(int pocket)
    {
        // Zero is the house pocket. Every outside bet loses on it, only a straight bet on zero wins.
        if (pocket == 0) return Type == RouletteBetType.Straight && Selection == 0;

        return Type switch
        {
            RouletteBetType.Straight => Selection == pocket,
            RouletteBetType.Red => RedPockets.Contains((short)pocket),
            RouletteBetType.Black => !RedPockets.Contains((short)pocket),
            RouletteBetType.Odd => pocket % 2 == 1,
            RouletteBetType.Even => pocket % 2 == 0,
            RouletteBetType.Low => pocket <= 18,
            RouletteBetType.High => pocket >= 19,
            RouletteBetType.Dozen => (pocket - 1) / 12 + 1 == Selection,
            RouletteBetType.Column => (pocket - 1) % 3 + 1 == Selection,
            _ => false
        };
    }

    public decimal PayoutFor(int pocket) => Covers(pocket) ? Stake * 36 / CoverCount : 0m;

    internal void Settle(int pocket) => Payout = PayoutFor(pocket);
}
