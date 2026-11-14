using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AuctionServer.Api.Tests.Errors;

public class BindingFailureTests
{
    private static WebApplicationFactory<Program> CreateProductionFactory()
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Production");
            host.UseSetting("ConnectionStrings:DefaultConnection",
                "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none");
            host.UseSetting("Jwt:Key", "test-signing-key-long-enough-for-hmac-sha256");
        });
    }

    [Theory]
    [InlineData("/api/auctions")]
    [InlineData("/api/auctions?limit=abc")]
    public async Task BindingFailure_InProduction_ShouldAnswerWithJsonError(string path)
    {
        await using var factory = CreateProductionFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("limit", body!["error"]);
    }
}
