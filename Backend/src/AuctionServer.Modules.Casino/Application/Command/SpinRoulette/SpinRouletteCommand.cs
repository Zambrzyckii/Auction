using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.SpinRoulette;

public record SpinRouletteCommand(Guid UserId, IReadOnlyList<RouletteBetRequest> Bets) : IRequest<RouletteSpinDto>;

public record RouletteBetRequest(RouletteBetType Type, short? Selection, decimal Stake);

public record RouletteSpinDto(
    Guid PublicSpinId,
    short Pocket,
    string Color,
    decimal TotalStake,
    decimal TotalPayout,
    decimal Balance,
    DateTime PlacedOn,
    IReadOnlyList<RouletteBetResultDto> Bets);

public record RouletteBetResultDto(RouletteBetType Type, short? Selection, decimal Stake, decimal Payout);
