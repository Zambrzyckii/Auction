using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Queries.GetCasino;

public class GetCasinoQueryHandler(ICasinoRepository repository, CasinoOptions options)
    : IRequestHandler<GetCasinoQuery, CasinoDto>
{
    public async Task<CasinoDto> Handle(GetCasinoQuery request, CancellationToken token)
    {
        var account = await repository.GetAccountReadOnlyAsync(request.UserId, token);
        var latestPurchase = await repository.GetLatestPurchaseReadOnlyAsync(request.UserId, token);
        var activeHand = await repository.GetActiveHandReadOnlyAsync(request.UserId, token);

        var purchaseDto = latestPurchase is null
            ? null
            : new ChipPurchaseDto(latestPurchase.PublicPurchaseId, latestPurchase.Amount, latestPurchase.Status,
                latestPurchase.RequestedOn, latestPurchase.ResolvedOn, latestPurchase.RejectionReason);
        var activeHandDto = activeHand is null
            ? null
            : new ActiveBlackjackHandDto(activeHand.PublicHandId, activeHand.Stake, activeHand.Doubled,
                activeHand.PlayerCards, activeHand.PlayerValue.Total, activeHand.PlayerValue.IsSoft,
                activeHand.VisibleDealerCards, activeHand.StartedOn, activeHand.LastActionOn);

        return new CasinoDto(
            account?.Balance ?? 0m,
            account?.LifetimeBought ?? 0m,
            account?.LifetimeCashedOut ?? 0m,
            purchaseDto,
            activeHandDto,
            new RouletteLimitsDto(options.Roulette.MinBet, options.Roulette.MaxBet, options.Roulette.MaxBetsPerSpin),
            new BlackjackLimitsDto(options.Blackjack.MinBet, options.Blackjack.MaxBet));
    }
}
