using AuctionServer.Modules.Casino.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetBlackjackHands;

public class GetBlackjackHandsQueryHandler(ICasinoRepository repository)
    : IRequestHandler<GetBlackjackHandsQuery, IReadOnlyList<BlackjackHandHistoryDto>>
{
    private const int HistorySize = 20;

    public async Task<IReadOnlyList<BlackjackHandHistoryDto>> Handle(GetBlackjackHandsQuery request, CancellationToken token)
    {
        var hands = await repository.GetRecentCompletedHandsReadOnlyAsync(request.UserId, HistorySize, token);

        return hands.Select(h => new BlackjackHandHistoryDto(h.PublicHandId, h.Stake, h.Doubled, h.Outcome,
                h.Payout, h.PlayerCards, h.DealerCards, h.PlayerValue.Total, h.DealerValue.Total,
                h.AutoStood, h.StartedOn, h.CompletedOn))
            .ToList();
    }
}
