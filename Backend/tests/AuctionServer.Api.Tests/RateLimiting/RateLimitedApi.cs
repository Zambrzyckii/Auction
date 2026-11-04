using AuctionServer.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace AuctionServer.Api.Tests.RateLimiting;

public sealed class RateLimitedApi : IAsyncLifetime
{
    public const string JwtKey = "rate-limited-api-signing-key-long-enough-for-hmac-sha256";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder(TestDatabase.Image)
        .WithDatabase("rate_limited_api")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public RateLimitedApi()
    {
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseSetting("ConnectionStrings:DefaultConnection", _postgres.GetConnectionString());
            host.UseSetting("Jwt:Key", JwtKey);
            host.UseSetting("Database:MigrateOnStartup", "true");
            host.UseSetting("RateLimiting:Enabled", "true");
            host.UseSetting("RateLimiting:Writes:TokenLimit", "100");
            host.UseSetting("RateLimiting:Writes:TokensPerPeriod", "100");
            host.UseSetting("RateLimiting:Writes:PeriodSeconds", "1");
            host.UseSetting("RateLimiting:HotWrites:TokenLimit", "3");
            host.UseSetting("RateLimiting:HotWrites:TokensPerPeriod", "1");
            host.UseSetting("RateLimiting:HotWrites:PeriodSeconds", "60");
            host.UseSetting("RateLimiting:Uploads:TokenLimit", "1");
            host.UseSetting("RateLimiting:Uploads:TokensPerPeriod", "1");
            host.UseSetting("RateLimiting:Uploads:PeriodSeconds", "60");
        });
    }

    public WebApplicationFactory<Program> Factory { get; }

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}
