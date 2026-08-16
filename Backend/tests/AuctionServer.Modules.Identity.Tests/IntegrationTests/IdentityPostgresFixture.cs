using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[CollectionDefinition(IdentityIntegrationCollection.Name)]
public sealed class IdentityIntegrationCollection : ICollectionFixture<IdentityPostgresFixture>
{
    public const string Name = "IdentityIntegration";
}

public sealed class IdentityPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:latest")
        .WithDatabase("identity_integration_tests")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
        await using var context = CreateContext();
        await context.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await _dbContainer.DisposeAsync();

    public IdentityDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new IdentityDbContext(options);
    }

    public async Task<User> SeedUserAsync(string email)
    {
        await using var context = CreateContext();
        var user = new User(email, "hash", "username", "Jan", "Kowalski", new DateOnly(2000, 1, 1));
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    public static string UniqueEmail() => $"{Guid.NewGuid():N}@test.com";
}
