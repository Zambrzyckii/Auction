using System.Diagnostics;
using Npgsql;

namespace AuctionServer.Api.Tests.IntegrationTests.PgBouncer;

[Collection(PgBouncerCollection.Name)]
public class PgBouncerPoolTests(PgBouncerFixture fixture)
{
    private const int Clients = 40;
    private const int DefaultPoolSize = 25;

    [Fact]
    public async Task Pool_WhenClientsOutnumberServers_ShouldQueueInsteadOfOpeningMore()
    {
        var stopwatch = Stopwatch.StartNew();
        await Task.WhenAll(Enumerable.Range(0, Clients).Select(_ => SleepTwoSecondsAsync()));
        stopwatch.Stop();
        var pool = await fixture.ShowPoolAsync();
        var serverConnections = new[] { "sv_active", "sv_idle", "sv_used", "sv_tested", "sv_login" }.Sum(column => int.Parse(pool[column]));

        Assert.Equal(DefaultPoolSize, serverConnections);
        Assert.True(int.Parse(pool["cl_active"]) >= Clients, $"cl_active was {pool["cl_active"]}");
        Assert.True(stopwatch.Elapsed >= TimeSpan.FromSeconds(4), $"{Clients} clients finished after {stopwatch.Elapsed}");
    }

    private async Task SleepTwoSecondsAsync()
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT pg_sleep(2)", connection);
        await command.ExecuteNonQueryAsync();
    }
}
