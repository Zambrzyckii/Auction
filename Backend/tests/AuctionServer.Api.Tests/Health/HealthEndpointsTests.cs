using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AuctionServer.Api.Tests.Health;

public class HealthEndpointsTests
{
    private static WebApplicationFactory<Program> CreateFactoryWithUnreachableDatabase()
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseSetting("ConnectionStrings:DefaultConnection",
                "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none");
            host.UseSetting("Jwt:Key", "test-signing-key-long-enough-for-hmac-sha256");
        });
    }

    [Fact]
    public async Task Live_WhenDatabaseIsUnreachable_ShouldReturnHealthy()
    {
        await using var factory = CreateFactoryWithUnreachableDatabase();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Ready_WhenDatabaseIsUnreachable_ShouldReturnServiceUnavailable()
    {
        await using var factory = CreateFactoryWithUnreachableDatabase();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_WhenDatabaseIsUnreachable_ShouldReturnServiceUnavailable()
    {
        await using var factory = CreateFactoryWithUnreachableDatabase();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync());
    }
}
