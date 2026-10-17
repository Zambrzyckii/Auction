using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetRouletteSpins;

public class GetRouletteSpinsQueryHandler(ICasinoRepository repository)
    : IRequestHandler<GetRouletteSpinsQuery, IReadOnlyList<RouletteSpinHistoryDto>>
{
    private const int HistorySize = 20;

    public async Task<IReadOnlyList<RouletteSpinHistoryDto>> Handle(GetRouletteSpinsQuery request, CancellationToken token)
    {
        var spins = await repository.GetRecentSpinsReadOnlyAsync(request.UserId, HistorySize, token);

        return spins.Select(s => new RouletteSpinHistoryDto(s.PublicSpinId, s.Pocket, RouletteSpin.ColorOf(s.Pocket),
                s.TotalStake, s.TotalPayout, s.PlacedOn,
                s.Bets.Select(b => new RouletteBetHistoryDto(b.Type, b.Selection, b.Stake, b.Payout)).ToList()))
            .ToList();
    }
}
