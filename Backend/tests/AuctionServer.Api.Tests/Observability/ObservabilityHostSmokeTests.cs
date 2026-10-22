using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AuctionServer.Api.Tests.Observability;

public class ObservabilityHostSmokeTests
{
    private static WebApplicationFactory<Program> CreateFactory(params (string Key, string Value)[] settings)
    {
        var baseline = new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] =
                "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none",
            ["Jwt:Key"] = "test-signing-key-long-enough-for-hmac-sha256"
        };
        foreach (var (key, value) in settings) baseline[key] = value;

        return new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            foreach (var (key, value) in baseline) host.UseSetting(key, value);
        });
    }

    [Fact]
    public async Task Host_WhenObservabilityIsDisabled_ShouldServeRequests()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Host_WhenOtlpEndpointIsUnreachable_ShouldStillServeRequests()
    {
        await using var factory = CreateFactory(
            ("Observability:Enabled", "true"),
            ("Observability:OtlpEndpoint", "http://127.0.0.1:19"));
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Host_WhenObservabilitySectionIsInvalid_ShouldFailStartup()
    {
        await using var factory = CreateFactory(("Observability:Enabled", "true"));

        Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        await Task.CompletedTask;
    }
}
