using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetRouletteSpins;

public record GetRouletteSpinsQuery(Guid UserId) : IRequest<IReadOnlyList<RouletteSpinHistoryDto>>;

public record RouletteSpinHistoryDto(
    Guid PublicSpinId,
    short Pocket,
    string Color,
    decimal TotalStake,
    decimal TotalPayout,
    DateTime PlacedOn,
    IReadOnlyList<RouletteBetHistoryDto> Bets);

public record RouletteBetHistoryDto(RouletteBetType Type, short? Selection, decimal Stake, decimal Payout);
