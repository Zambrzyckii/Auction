using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetCasino;

public record GetCasinoQuery(Guid UserId) : IRequest<CasinoDto>;

public record CasinoDto(
    decimal Balance,
    decimal LifetimeBought,
    decimal LifetimeCashedOut,
    ChipPurchaseDto? LatestPurchase,
    RouletteLimitsDto Roulette,
    BlackjackLimitsDto Blackjack);

public record ChipPurchaseDto(
    Guid PublicPurchaseId,
    decimal Amount,
    ChipPurchaseStatus Status,
    DateTime RequestedOn,
    DateTime? ResolvedOn,
    string? RejectionReason);

public record RouletteLimitsDto(decimal MinBet, decimal MaxBet, int MaxBetsPerSpin);

public record BlackjackLimitsDto(decimal MinBet, decimal MaxBet);
