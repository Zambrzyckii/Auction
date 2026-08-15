using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using Dapper;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public class GetActiveAuctionsQueryHandler(ISqlConnectionFactory sqlFactory) : IRequestHandler<GetActiveAuctionsQuery, List<AuctionQueryDto>>
{
    public async Task<List<AuctionQueryDto>> Handle(GetActiveAuctionsQuery query, CancellationToken cancellationToken)
    {
        using IDbConnection connection = sqlFactory.CreateConnection();

        const string sql = """
                           SELECT "PublicAuctionId", "CurrentPrice"
                           FROM "Auctions"
                           WHERE "IsClosed" = false
                           LIMIT @Limit;
                           """;

        var command = new CommandDefinition(sql, new { query.Limit }, cancellationToken: cancellationToken);
        var results = await connection.QueryAsync<AuctionQueryDto>(command);
        return results.ToList();
    }
}