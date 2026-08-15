using System.Data;

namespace AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;

public interface ISqlConnectionFactory
{
    IDbConnection CreateConnection();
}