using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;

public record StartBlackjackHandCommand(Guid UserId, decimal Stake) : IRequest<BlackjackHandDto>;

public record BlackjackHandDto(
    Guid PublicHandId,
    BlackjackHandStatus Status,
    decimal Stake,
    bool Doubled,
    IReadOnlyList<int> PlayerCards,
    int PlayerTotal,
    bool PlayerIsSoft,
    IReadOnlyList<int> VisibleDealerCards,
    int? DealerTotal,
    BlackjackOutcome? Outcome,
    decimal? Payout,
    bool AutoStood,
    decimal Balance,
    DateTime StartedOn,
    DateTime? CompletedOn)
{
    public static BlackjackHandDto From(BlackjackHand hand, decimal balance) =>
        new(hand.PublicHandId, hand.Status, hand.Stake, hand.Doubled, hand.PlayerCards,
            hand.PlayerValue.Total, hand.PlayerValue.IsSoft, hand.VisibleDealerCards,
            hand.Status == BlackjackHandStatus.Completed ? hand.DealerValue.Total : null,
            hand.Outcome, hand.Payout, hand.AutoStood, balance, hand.StartedOn, hand.CompletedOn);
}
