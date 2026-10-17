using AuctionServer.Modules.Casino.Domain.Cards;

namespace AuctionServer.Modules.Casino.Tests.Domain.Cards;

public sealed class ScriptedCardSource(params string[] cards) : ICardSource
{
    private readonly Queue<Card> _cards = new(cards.Select(TestCards.Parse));

    public int RemainingCards => _cards.Count;

    public Card Draw(IReadOnlyCollection<Card> dealt) => _cards.Dequeue();
}
