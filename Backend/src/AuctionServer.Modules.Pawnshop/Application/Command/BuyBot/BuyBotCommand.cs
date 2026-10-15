using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Command.BuyBot;

public record BuyBotCommand(Guid UserId, string TierName) : IRequest;
