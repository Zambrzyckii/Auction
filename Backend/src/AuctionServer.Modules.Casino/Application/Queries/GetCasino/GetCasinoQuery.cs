using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetCasino;

public record GetCasinoQuery(Guid UserId) : IRequest<CasinoDto>;

public record CasinoDto(
    decimal Balance,
    decimal LifetimeBought,
    decimal LifetimeCashedOut,
    ChipPurchaseDto? LatestPurchase,
    ActiveBlackjackHandDto? ActiveBlackjackHand,
    RouletteLimitsDto Roulette,
    BlackjackLimitsDto Blackjack);

public record ActiveBlackjackHandDto(
    Guid PublicHandId,
    decimal Stake,
    bool Doubled,
    IReadOnlyList<int> PlayerCards,
    int PlayerTotal,
    bool PlayerIsSoft,
    IReadOnlyList<int> VisibleDealerCards,
    DateTime StartedOn,
    DateTime LastActionOn);

public record ChipPurchaseDto(
    Guid PublicPurchaseId,
    decimal Amount,
    ChipPurchaseStatus Status,
    DateTime RequestedOn,
    DateTime? ResolvedOn,
    string? RejectionReason);

public record RouletteLimitsDto(decimal MinBet, decimal MaxBet, int MaxBetsPerSpin);

public record BlackjackLimitsDto(decimal MinBet, decimal MaxBet);
