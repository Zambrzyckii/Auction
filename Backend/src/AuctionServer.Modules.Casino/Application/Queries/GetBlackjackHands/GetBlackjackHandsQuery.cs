using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetBlackjackHands;

public record GetBlackjackHandsQuery(Guid UserId) : IRequest<IReadOnlyList<BlackjackHandHistoryDto>>;

public record BlackjackHandHistoryDto(
    Guid PublicHandId,
    decimal Stake,
    bool Doubled,
    BlackjackOutcome? Outcome,
    decimal? Payout,
    IReadOnlyList<int> PlayerCards,
    IReadOnlyList<int> DealerCards,
    int PlayerTotal,
    int DealerTotal,
    bool AutoStood,
    DateTime StartedOn,
    DateTime? CompletedOn);
