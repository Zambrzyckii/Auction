using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionById;

public record GetAuctionByIdQuery(Guid PublicAuctionId) : IRequest<AuctionByIdQueryDto>;