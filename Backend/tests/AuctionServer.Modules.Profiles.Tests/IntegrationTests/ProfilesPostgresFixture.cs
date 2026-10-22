using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[CollectionDefinition(ProfilesIntegrationCollection.Name)]
public sealed class ProfilesIntegrationCollection : ICollectionFixture<ProfilesPostgresFixture>
{
    public const string Name = "ProfilesIntegration";
}

public sealed class ProfilesPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:latest")
        .WithDatabase("profiles_integration_tests")
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

    public ProfilesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ProfilesDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new ProfilesDbContext(options);
    }

    public async Task<Guid> SeedProfileAsync(string username = "seed-player")
    {
        await using var context = CreateContext();
        var profile = UserProfile.Create(Guid.NewGuid(), username, DateTime.UtcNow);
        context.UserProfiles.Add(profile);
        await context.SaveChangesAsync();
        return profile.UserId;
    }

    public async Task<UserProfile> GetProfileAsync(Guid userId)
    {
        await using var context = CreateContext();
        return await context.UserProfiles.AsNoTracking().SingleAsync(p => p.UserId == userId);
    }
}
