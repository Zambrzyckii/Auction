using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public record GetActiveAuctionsQuery(int Limit) : IRequest<List<ActiveAuctionQueryDto>>;
