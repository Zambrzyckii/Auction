using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace AuctionServer.TestSupport;

public class SagaStage<TEntryPoint> : IAsyncLifetime where TEntryPoint : class
{
    public const string JwtKey = "saga-stage-signing-key-long-enough-for-hmac-sha256";

    private static readonly string[] MessageTables =
    [
        "OutboxMessages",
        "IdentityOutboxMessages",
        "InventoryOutboxMessages",
        "WalletsOutboxMessages",
        "WarehousesOutboxMessages",
        "BankingOutboxMessages",
        "PawnshopOutboxMessages",
        "CasinoOutboxMessages",
        "DeliveryMessages"
    ];

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder(TestDatabase.Image)
        .WithDatabase("saga_stage")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public SagaStage()
    {
        Factory = new WebApplicationFactory<TEntryPoint>().WithWebHostBuilder(host =>
        {
            host.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
            host.UseSetting("Jwt:Key", JwtKey);
            host.UseSetting("Database:MigrateOnStartup", "true");
        });
    }

    public WebApplicationFactory<TEntryPoint> Factory { get; }

    public string ConnectionString => _postgres.GetConnectionString();

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    public async Task WaitForOutboxQuietAsync(bool fastForwardRetries = false, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(30));
        while (DateTime.UtcNow < deadline)
        {
            if (fastForwardRetries) await FastForwardRetriesAsync();
            if (await CountPendingAsync() == 0) return;
            await Task.Delay(200);
        }

        throw new TimeoutException($"Message tables still hold {await CountPendingAsync()} pending messages");
    }

    public async Task FastForwardRetriesAsync()
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        foreach (var table in MessageTables)
        {
            var sql = $"""UPDATE "{table}" SET "NextAttemptOn" = now(), "LeasedUntil" = NULL WHERE "ProcessedOn" IS NULL AND NOT "IsDead" AND ("NextAttemptOn" > now() OR "LeasedUntil" > now())""";
            await using var command = new NpgsqlCommand(sql, connection);
            await command.ExecuteNonQueryAsync();
        }
    }

    private async Task<long> CountPendingAsync()
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        long pending = 0;
        foreach (var table in MessageTables)
        {
            var sql = $"""SELECT count(*) FROM "{table}" WHERE "ProcessedOn" IS NULL AND NOT "IsDead" """;
            await using var command = new NpgsqlCommand(sql, connection);
            pending += (long)(await command.ExecuteScalarAsync())!;
        }

        return pending;
    }
}
