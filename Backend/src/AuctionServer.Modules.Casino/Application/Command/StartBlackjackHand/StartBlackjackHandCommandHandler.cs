using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Cards;
using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;

public class StartBlackjackHandCommandHandler(ICasinoRepository repository, ICardSource cardSource, CasinoOptions options)
    : IRequestHandler<StartBlackjackHandCommand, BlackjackHandDto>
{
    public async Task<BlackjackHandDto> Handle(StartBlackjackHandCommand request, CancellationToken token)
    {
        if (request.Stake < options.Blackjack.MinBet || request.Stake > options.Blackjack.MaxBet)
            throw new CasinoExceptions.InvalidBlackjackStakeException(
                $"Stake must be between {options.Blackjack.MinBet} and {options.Blackjack.MaxBet}");

        var account = await repository.GetAccountByUserIdAsync(request.UserId, token);
        account.PlaceStake(request.Stake);

        var hand = BlackjackHand.Start(request.UserId, request.Stake, cardSource, DateTime.UtcNow);
        if (hand.Payout > 0) account.Credit(hand.Payout.Value);

        await repository.SaveNewHandAsync(hand, token);
        return BlackjackHandDto.From(hand, account.Balance);
    }
}
