using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.CreateAuction;

public record CreateAuctionCommand(Guid SellerId, Guid ItemId, decimal StartingPrice, DateTime EndsOn) : IRequest<Guid>;