using AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;
using AuctionServer.Modules.Casino.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.ActOnBlackjackHand;

public record ActOnBlackjackHandCommand(Guid UserId, Guid PublicHandId, BlackjackAction Action) : IRequest<BlackjackHandDto>;
