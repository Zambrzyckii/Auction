using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

// ProfilesCustomApi sets process-wide environment variables, so every test class using it
// must share one instance through this collection instead of IClassFixture.
[CollectionDefinition(ProfilesHostCollection.Name)]
public sealed class ProfilesHostCollection : ICollectionFixture<ProfilesCustomApi>
{
    public const string Name = "ProfilesHostIntegration";
}

public class ProfilesCustomApi : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string TestJwtKey = "profiles-integration-tests-signing-key-1234567890";

    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:latest")
        .WithDatabase("profiles_host_tests")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public FakeAvatarStorage AvatarStorage { get; } = new();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();

        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _dbContainer.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Key", TestJwtKey);

        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        await context.Database.MigrateAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _dbContainer.GetConnectionString()
            });
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IAvatarStorage>();
            services.AddSingleton<IAvatarStorage>(AvatarStorage);
        });
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", null);
        Environment.SetEnvironmentVariable("Jwt__Key", null);
        await _dbContainer.DisposeAsync();
    }
}
