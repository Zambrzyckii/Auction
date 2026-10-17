namespace AuctionServer.Modules.Casino.Domain.Cards;

public interface ICardSource
{
    Card Draw(IReadOnlyCollection<Card> dealt);
}
