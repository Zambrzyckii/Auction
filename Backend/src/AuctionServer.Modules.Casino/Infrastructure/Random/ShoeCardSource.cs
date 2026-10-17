using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Cards;

namespace AuctionServer.Modules.Casino.Infrastructure.Random;

public sealed class ShoeCardSource(ICasinoRandom random) : ICardSource
{
    public const int Decks = 6;

    public Card Draw(IReadOnlyCollection<Card> dealt)
    {
        var remaining = Decks * Card.DeckSize - dealt.Count;
        var pick = random.Next(remaining);

        Span<int> dealtPerCode = stackalloc int[Card.DeckSize];
        foreach (var card in dealt) dealtPerCode[card.Code]++;

        for (var code = 0; code < Card.DeckSize; code++)
        {
            var available = Decks - dealtPerCode[code];
            if (pick < available) return new Card(code);
            pick -= available;
        }

        throw new InvalidOperationException("The shoe is empty");
    }
}
