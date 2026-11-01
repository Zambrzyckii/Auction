using AuctionServer.TestSupport;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

[CollectionDefinition(OutboxIntegrationCollection.Name)]
public sealed class OutboxIntegrationCollection : ICollectionFixture<OutboxPostgresFixture>
{
    public const string Name = "OutboxIntegration";
}

public sealed class OutboxPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder(TestDatabase.Image)
        .WithDatabase("outbox_integration_tests")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
        await using var context = CreateContext();
        await context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync() => await _dbContainer.DisposeAsync();

    public OutboxTestDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<OutboxTestDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new OutboxTestDbContext(options);
    }

    public async Task ResetAsync()
    {
        await using var context = CreateContext();
        await context.Database.ExecuteSqlRawAsync("""DELETE FROM "TestOutboxMessages" """);
    }
}
