using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.SpinRoulette;

public class SpinRouletteCommandHandler(ICasinoRepository repository, ICasinoRandom random, CasinoOptions options)
    : IRequestHandler<SpinRouletteCommand, RouletteSpinDto>
{
    public async Task<RouletteSpinDto> Handle(SpinRouletteCommand request, CancellationToken token)
    {
        var account = await repository.GetAccountByUserIdAsync(request.UserId, token);

        var bets = request.Bets
            .Select(b => new RouletteBet { Type = b.Type, Selection = b.Selection, Stake = b.Stake })
            .ToList();
        var pocket = random.Next(37);
        var spin = RouletteSpin.Resolve(request.UserId, bets, pocket,
            options.Roulette.MinBet, options.Roulette.MaxBet, options.Roulette.MaxBetsPerSpin, DateTime.UtcNow);

        account.PlaceStake(spin.TotalStake);
        if (spin.TotalPayout > 0) account.Credit(spin.TotalPayout);

        await repository.SaveNewSpinAsync(spin, token);

        return new RouletteSpinDto(spin.PublicSpinId, spin.Pocket, RouletteSpin.ColorOf(spin.Pocket),
            spin.TotalStake, spin.TotalPayout, account.Balance, spin.PlacedOn,
            spin.Bets.Select(b => new RouletteBetResultDto(b.Type, b.Selection, b.Stake, b.Payout)).ToList());
    }
}
