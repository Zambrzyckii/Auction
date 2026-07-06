using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;
using System.Data;
using Npgsql;

namespace AuctionServer.Modules.Auctions.Infrastructure;

public class SqlConnectionFactory(string connectionString) : ISqlConnectionFactory
{
    public IDbConnection CreateConnection()
    {
        return new NpgsqlConnection(connectionString);
    }
}