using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;
using Dapper;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public class GetActiveAuctionsQueryHandler(ISqlConnectionFactory sqlFactory)
{
    public async Task<List<AuctionQueryDto>> GetAuctionPageAsync(GetActiveAuctionsQuery query)
    {
        using IDbConnection connection = sqlFactory.CreateConnection();

        const string sql = """
                           SELECT PublicAuctionId, CurrentPrice
                           FROM Auctions
                           WHERE IsClosed = false
                           LIMIT @Limit
                           """;
        var results = await connection.QueryAsync<AuctionQueryDto>(sql,
            new { query.Limit });
        return results.ToList();
    }
}