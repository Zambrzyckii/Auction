using System.Data;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using Npgsql;

namespace AuctionServer.Modules.Auctions.Infrastructure.Persistence;

public class SqlConnectionFactory(string connectionString) : ISqlConnectionFactory
{
    public IDbConnection CreateConnection()
    {
        return new NpgsqlConnection(connectionString);
    }
}