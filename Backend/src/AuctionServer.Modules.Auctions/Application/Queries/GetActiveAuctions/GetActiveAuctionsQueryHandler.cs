using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Enums;
using Dapper;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public class GetActiveAuctionsQueryHandler(ISqlConnectionFactory sqlFactory) : IRequestHandler<GetActiveAuctionsQuery, List<ActiveAuctionQueryDto>>
{
    public async Task<List<ActiveAuctionQueryDto>> Handle(GetActiveAuctionsQuery query, CancellationToken cancellationToken)
    {
        using IDbConnection connection = sqlFactory.CreateConnection();

        const string sql = """
                           SELECT "PublicAuctionId", "SellerUserId", "CurrentWinningUserId", "Status", "CurrentPrice", "EndsOn",
                                  "ItemName", "ItemRarity", "ItemOfficialPrice", "CancellationReason"
                           FROM "Auctions"
                           WHERE "Status" = @Active
                           ORDER BY "EndsOn"
                           LIMIT @Limit;
                           """;

        var command = new CommandDefinition(sql, new { query.Limit, Active = (int)AuctionStatus.Active }, cancellationToken: cancellationToken);
        var results = await connection.QueryAsync<ActiveAuctionQueryDto>(command);
        return results.ToList();
    }
}