using AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;
using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Cards;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.ActOnBlackjackHand;

public class ActOnBlackjackHandCommandHandler(ICasinoRepository repository, ICardSource cardSource)
    : IRequestHandler<ActOnBlackjackHandCommand, BlackjackHandDto>
{
    public async Task<BlackjackHandDto> Handle(ActOnBlackjackHandCommand request, CancellationToken token)
    {
        var hand = await repository.GetHandByPublicIdAsync(request.PublicHandId, token);
        if (hand.UserId != request.UserId) throw new CasinoExceptions.HandNotFoundException();

        var account = await repository.GetAccountByUserIdAsync(request.UserId, token);
        var now = DateTime.UtcNow;

        switch (request.Action)
        {
            case BlackjackAction.Hit:
                hand.Hit(cardSource, now);
                break;
            case BlackjackAction.Stand:
                hand.Stand(cardSource, now);
                break;
            case BlackjackAction.Double:
                account.PlaceStake(hand.Stake);
                hand.Double(cardSource, now);
                break;
            default:
                throw new CasinoExceptions.InvalidBlackjackActionException("Unknown blackjack action");
        }

        if (hand.Payout > 0) account.Credit(hand.Payout.Value);

        await repository.SaveChangesAsync(token);
        return BlackjackHandDto.From(hand, account.Balance);
    }
}
