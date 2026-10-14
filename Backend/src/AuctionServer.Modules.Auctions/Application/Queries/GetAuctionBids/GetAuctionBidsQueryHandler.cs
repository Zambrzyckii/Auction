using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using Dapper;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionBids;

public class GetAuctionBidsQueryHandler(ISqlConnectionFactory sqlFactory) : IRequestHandler<GetAuctionBidsQuery, List<AuctionBidQueryDto>>
{
    public async Task<List<AuctionBidQueryDto>> Handle(GetAuctionBidsQuery query, CancellationToken cancellationToken)
    {
        using IDbConnection connection = sqlFactory.CreateConnection();

        const string existsSql = """
                                 SELECT 1
                                 FROM "Auctions"
                                 WHERE "PublicAuctionId" = @PublicAuctionId
                                 """;
        var exists = await connection.ExecuteScalarAsync<int?>(
            new CommandDefinition(existsSql, new { query.PublicAuctionId }, cancellationToken: cancellationToken));
        if (exists is null) throw new AuctionExceptions.AuctionNotFoundException(query.PublicAuctionId);

        const string sql = """
                           SELECT "BidderUserId", "Amount", "PlacedOn"
                           FROM "AuctionsBids"
                           WHERE "PublicAuctionId" = @PublicAuctionId
                           ORDER BY "PlacedOn" DESC, "Id" DESC;
                           """;
        var command = new CommandDefinition(sql, new { query.PublicAuctionId }, cancellationToken: cancellationToken);
        var results = await connection.QueryAsync<AuctionBidQueryDto>(command);
        return results.ToList();
    }
}
