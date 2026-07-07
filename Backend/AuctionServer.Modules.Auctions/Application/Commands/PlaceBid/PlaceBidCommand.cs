using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

public record PlaceBidCommand(Guid PublicAuctionId, decimal NewPrice) : IRequest;