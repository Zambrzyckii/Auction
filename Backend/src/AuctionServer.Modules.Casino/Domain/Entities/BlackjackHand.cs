using AuctionServer.Modules.Casino.Domain.Cards;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Domain.Entities;

public sealed class BlackjackHand
{
    public long Id { get; init; }
    public Guid PublicHandId { get; init; } = Guid.NewGuid();
    public Guid UserId { get; init; }
    public BlackjackHandStatus Status { get; private set; } = BlackjackHandStatus.InProgress;
    public decimal Stake { get; private set; }
    public bool Doubled { get; private set; }
    public List<int> PlayerCards { get; private set; } = [];
    public List<int> DealerCards { get; private set; } = [];
    public BlackjackOutcome? Outcome { get; private set; }
    public decimal? Payout { get; private set; }
    public bool AutoStood { get; private set; }
    public DateTime StartedOn { get; init; }
    public DateTime LastActionOn { get; private set; }
    public DateTime? CompletedOn { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    private List<Card> Player => PlayerCards.Select(c => new Card(c)).ToList();
    private List<Card> Dealer => DealerCards.Select(c => new Card(c)).ToList();
    private List<Card> DealtCards => PlayerCards.Concat(DealerCards).Select(c => new Card(c)).ToList();

    public HandValue PlayerValue => HandValue.Of(Player);
    public HandValue DealerValue => HandValue.Of(Dealer);

    public IReadOnlyList<int> VisibleDealerCards =>
        Status == BlackjackHandStatus.Completed ? DealerCards : DealerCards.Take(1).ToList();

    public static BlackjackHand Start(Guid userId, decimal stake, ICardSource cardSource, DateTime now)
    {
        if (stake <= 0 || stake != decimal.Truncate(stake)) throw new CasinoExceptions.InvalidChipAmountException();

        var hand = new BlackjackHand { UserId = userId, Stake = stake, StartedOn = now, LastActionOn = now };
        hand.DealTo(hand.PlayerCards, cardSource);
        hand.DealTo(hand.DealerCards, cardSource);
        hand.DealTo(hand.PlayerCards, cardSource);
        hand.DealTo(hand.DealerCards, cardSource);

        var dealerPeeks = hand.Dealer[0].IsAce || hand.Dealer[0].IsTenValue;
        if (HandValue.IsBlackjack(hand.Player) || (dealerPeeks && HandValue.IsBlackjack(hand.Dealer)))
            hand.Settle(now);

        return hand;
    }

    public void Hit(ICardSource cardSource, DateTime now)
    {
        EnsureInProgress();
        DealTo(PlayerCards, cardSource);

        var value = PlayerValue;
        if (value.IsBust)
        {
            Settle(now);
            return;
        }

        if (value.Total == 21)
        {
            FinishPlayerTurn(cardSource, now);
            return;
        }

        LastActionOn = now;
        Version = Guid.NewGuid();
    }

    public void Stand(ICardSource cardSource, DateTime now)
    {
        EnsureInProgress();
        FinishPlayerTurn(cardSource, now);
    }

    public void Double(ICardSource cardSource, DateTime now)
    {
        EnsureInProgress();
        if (PlayerCards.Count != 2)
            throw new CasinoExceptions.InvalidBlackjackActionException("Double is only allowed on the first two cards");

        Stake *= 2;
        Doubled = true;
        DealTo(PlayerCards, cardSource);

        if (PlayerValue.IsBust)
        {
            Settle(now);
            return;
        }

        FinishPlayerTurn(cardSource, now);
    }

    public void AutoStand(ICardSource cardSource, DateTime now)
    {
        EnsureInProgress();
        AutoStood = true;
        FinishPlayerTurn(cardSource, now);
    }

    private void FinishPlayerTurn(ICardSource cardSource, DateTime now)
    {
        while (HandValue.Of(Dealer).Total < 17) DealTo(DealerCards, cardSource);
        Settle(now);
    }

    private void DealTo(List<int> cards, ICardSource cardSource) => cards.Add(cardSource.Draw(DealtCards).Code);

    private void Settle(DateTime now)
    {
        var player = HandValue.Of(Player);
        var dealer = HandValue.Of(Dealer);
        var playerNatural = HandValue.IsBlackjack(Player);
        var dealerNatural = HandValue.IsBlackjack(Dealer);

        if (player.IsBust) Outcome = BlackjackOutcome.Lose;
        else if (playerNatural && dealerNatural) Outcome = BlackjackOutcome.Push;
        else if (playerNatural) Outcome = BlackjackOutcome.Blackjack;
        else if (dealerNatural) Outcome = BlackjackOutcome.Lose;
        else if (dealer.IsBust || player.Total > dealer.Total) Outcome = BlackjackOutcome.Win;
        else if (player.Total == dealer.Total) Outcome = BlackjackOutcome.Push;
        else Outcome = BlackjackOutcome.Lose;

        Payout = Outcome switch
        {
            BlackjackOutcome.Blackjack => Stake * 2.5m,
            BlackjackOutcome.Win => Stake * 2m,
            BlackjackOutcome.Push => Stake,
            _ => 0m
        };

        Status = BlackjackHandStatus.Completed;
        CompletedOn = now;
        LastActionOn = now;
        Version = Guid.NewGuid();
    }

    private void EnsureInProgress()
    {
        if (Status != BlackjackHandStatus.InProgress)
            throw new CasinoExceptions.InvalidBlackjackActionException("Hand is already completed");
    }
}
