using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using Dapper;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionById;

public class GetAuctionByIdQueryHandler(ISqlConnectionFactory sqlFactory) : IRequestHandler<GetAuctionByIdQuery, AuctionByIdQueryDto>
{
    public async Task<AuctionByIdQueryDto> Handle(GetAuctionByIdQuery query, CancellationToken cancellationToken)
    {
        using IDbConnection connection = sqlFactory.CreateConnection();

        const string sql = """
                           SELECT "PublicAuctionId", "SellerUserId", "CurrentWinningUserId", "Status", "CurrentPrice", "EndsOn",
                                  "ItemName", "ItemRarity", "ItemOfficialPrice", "CancellationReason"
                           FROM "Auctions"
                           WHERE "PublicAuctionId" = @PublicAuctionId
                           """;
        var command = new CommandDefinition(sql, new { query.PublicAuctionId }, cancellationToken: cancellationToken);
        var auction = await connection.QuerySingleOrDefaultAsync<AuctionByIdQueryDto>(command);
        return auction ?? throw new AuctionExceptions.AuctionNotFoundException(query.PublicAuctionId); 
    }
}