using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionBids;

public record GetAuctionBidsQuery(Guid PublicAuctionId) : IRequest<List<AuctionBidQueryDto>>;
