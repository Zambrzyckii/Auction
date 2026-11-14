using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using Dapper;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetMyAuctions;

public class GetMyAuctionsQueryHandler(ISqlConnectionFactory sqlFactory) : IRequestHandler<GetMyAuctionsQuery, List<MyAuctionQueryDto>>
{
    private const int MaxRows = 50;

    public async Task<List<MyAuctionQueryDto>> Handle(GetMyAuctionsQuery query, CancellationToken cancellationToken)
    {
        using IDbConnection connection = sqlFactory.CreateConnection();

        const string sql = """
                           SELECT "PublicAuctionId", "SellerUserId", "CurrentWinningUserId", "Status", "CurrentPrice", "EndsOn",
                                  "ItemName", "ItemRarity", "ItemOfficialPrice", "CancellationReason", "CreatedOn"
                           FROM "Auctions"
                           WHERE "SellerUserId" = @SellerUserId
                           ORDER BY "CreatedOn" DESC
                           LIMIT @MaxRows;
                           """;

        var command = new CommandDefinition(sql, new { query.SellerUserId, MaxRows }, cancellationToken: cancellationToken);
        var results = await connection.QueryAsync<MyAuctionQueryDto>(command);
        return results.ToList();
    }
}
