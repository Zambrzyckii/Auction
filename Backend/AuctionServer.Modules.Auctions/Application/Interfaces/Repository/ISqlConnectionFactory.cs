using System.Data;
namespace AuctionServer.Modules.Auctions.Application.Interfaces.Repository;

public interface ISqlConnectionFactory
{
    IDbConnection CreateConnection();
}