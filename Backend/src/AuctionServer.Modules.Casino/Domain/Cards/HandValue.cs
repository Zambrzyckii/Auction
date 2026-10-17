namespace AuctionServer.Modules.Casino.Domain.Cards;

public readonly record struct HandValue(int Total, bool IsSoft)
{
    public bool IsBust => Total > 21;

    public static HandValue Of(IReadOnlyList<Card> cards)
    {
        var total = cards.Sum(c => c.BaseValue);
        var isSoft = cards.Any(c => c.IsAce) && total + 10 <= 21;
        return new HandValue(isSoft ? total + 10 : total, isSoft);
    }

    public static bool IsBlackjack(IReadOnlyList<Card> cards) => cards.Count == 2 && Of(cards).Total == 21;
}
