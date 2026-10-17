namespace AuctionServer.Modules.Casino.Domain.Cards;

public readonly record struct Card(int Code)
{
    public const int DeckSize = 52;

    public int Rank => Code % 13;
    public bool IsAce => Rank == 0;
    public bool IsTenValue => Rank >= 9;
    public int BaseValue => IsAce ? 1 : Rank >= 9 ? 10 : Rank + 1;
}
