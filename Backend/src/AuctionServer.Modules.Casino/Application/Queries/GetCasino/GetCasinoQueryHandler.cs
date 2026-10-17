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

        var purchaseDto = latestPurchase is null
            ? null
            : new ChipPurchaseDto(latestPurchase.PublicPurchaseId, latestPurchase.Amount, latestPurchase.Status,
                latestPurchase.RequestedOn, latestPurchase.ResolvedOn, latestPurchase.RejectionReason);

        return new CasinoDto(
            account?.Balance ?? 0m,
            account?.LifetimeBought ?? 0m,
            account?.LifetimeCashedOut ?? 0m,
            purchaseDto,
            new RouletteLimitsDto(options.Roulette.MinBet, options.Roulette.MaxBet, options.Roulette.MaxBetsPerSpin),
            new BlackjackLimitsDto(options.Blackjack.MinBet, options.Blackjack.MaxBet));
    }
}
