using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Configurations;
using DotNet.Testcontainers.Containers;
using DotNet.Testcontainers.Networks;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Testcontainers.PostgreSql;

namespace AuctionServer.Api.Tests.IntegrationTests.PgBouncer;

public sealed class PgBouncerFixture : IAsyncLifetime
{
    private const string DatabaseName = "auctionserver";
    private const string Username = "auction";
    private const ushort PgBouncerPort = 6432;

    private readonly string _password = Guid.NewGuid().ToString();
    private readonly INetwork _network;
    private readonly PostgreSqlContainer _postgres;
    private readonly IContainer _pgBouncer;

    public PgBouncerFixture()
    {
        _network = new NetworkBuilder().Build();
        _postgres = new PostgreSqlBuilder("postgres:16-alpine")
            .WithNetwork(_network)
            .WithNetworkAliases("postgres")
            .WithDatabase(DatabaseName)
            .WithUsername(Username)
            .WithPassword(_password)
            .Build();
        _pgBouncer = new ContainerBuilder("edoburu/pgbouncer:v1.26.1-p0")
            .WithNetwork(_network)
            .WithEnvironment("DB_USER", Username)
            .WithEnvironment("DB_PASSWORD", _password)
            .WithEnvironment("AUTH_TYPE", "scram-sha-256")
            .WithEnvironment("PGPASSWORD", _password)
            .WithResourceMapping(File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "pgbouncer", "pgbouncer.ini")), "/etc/pgbouncer/pgbouncer.ini")
            .WithPortBinding(PgBouncerPort, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilCommandIsCompleted(
                ["pg_isready", "-h", "127.0.0.1", "-p", $"{PgBouncerPort}", "-U", Username, "-d", DatabaseName],
                strategy => strategy.WithMode(WaitStrategyMode.Running).WithTimeout(TimeSpan.FromSeconds(30))))
            .Build();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseSetting("ConnectionStrings:DefaultConnection", ConnectionString);
            host.UseSetting("Jwt:Key", "test-signing-key-long-enough-for-hmac-sha256");
            host.UseSetting("Database:MigrateOnStartup", "true");
        });
    }

    public WebApplicationFactory<Program> Factory { get; }

    public string ConnectionString => new NpgsqlConnectionStringBuilder
    {
        Host = _pgBouncer.Hostname,
        Port = _pgBouncer.GetMappedPublicPort(PgBouncerPort),
        Database = DatabaseName,
        Username = Username,
        Password = _password,
        NoResetOnClose = true
    }.ConnectionString;

    public async Task<IReadOnlyDictionary<string, string>> ShowPoolAsync()
    {
        var result = await _pgBouncer.ExecAsync(["psql", "-h", "127.0.0.1", "-p", $"{PgBouncerPort}", "-U", Username, "-d", "pgbouncer", "--csv", "-c", "SHOW POOLS"]);
        var lines = result.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        if (lines.Length == 0)
            throw new InvalidOperationException($"SHOW POOLS returned nothing: {result.Stderr}");

        var columns = lines[0].Split(',');
        var values = lines.Skip(1).Select(line => line.Split(',')).Single(row => row[0] == DatabaseName);
        return columns.Zip(values).ToDictionary(pair => pair.First, pair => pair.Second);
    }

    public async Task InitializeAsync()
    {
        await _network.CreateAsync();
        await _postgres.StartAsync();
        await _pgBouncer.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await _pgBouncer.DisposeAsync();
        await _postgres.DisposeAsync();
        await _network.DisposeAsync();
    }
}
