using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetMyAuctions;

public record GetMyAuctionsQuery(Guid SellerUserId) : IRequest<List<MyAuctionQueryDto>>;
