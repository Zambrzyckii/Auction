using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AuctionServer.Api.Infrastructure.Push;
using AuctionServer.Api.Tests.IntegrationTests.Messaging;
using AuctionServer.Shared.Infrastructure.Delivery;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Messaging;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace AuctionServer.Api.Tests.Push;

public class PushEndpointTests
{
    private const string JwtKey = "push-endpoint-tests-signing-key-long-enough-for-hmac-sha256";
    private static readonly PushOptions FastHeartbeat = new(TimeSpan.FromMilliseconds(300), 8, 4);
    private static readonly TimeSpan ReadTimeout = TimeSpan.FromSeconds(3);

    private sealed record SseEvent(string Event, string Data);

    private static WebApplicationFactory<Program> CreateFactory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Production");
            host.UseSetting("ConnectionStrings:DefaultConnection",
                "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none");
            host.UseSetting("Jwt:Key", JwtKey);
            host.ConfigureTestServices(services =>
            {
                services.RemoveAll<PushOptions>();
                services.AddSingleton(FastHeartbeat);
                services.RemoveAll<IIntegrationEventDispatcher>();
                services.AddScoped<IIntegrationEventDispatcher>(_ => new RecordingDispatcher());
            });
        });

    private static string CreateToken(Guid userId, TimeSpan lifetime)
    {
        var handler = new JwtSecurityTokenHandler();
        var now = DateTime.UtcNow;
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, "User")
            ]),
            Issuer = "AuctionServer",
            Audience = "AuctionServer.Client",
            NotBefore = now.AddMinutes(-10),
            IssuedAt = now.AddMinutes(-10),
            Expires = now + lifetime,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey)), SecurityAlgorithms.HmacSha256Signature)
        };
        return handler.WriteToken(handler.CreateToken(descriptor));
    }

    private static async Task<HttpResponseMessage> OpenStreamAsync(HttpClient client, string? token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/push");
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
    }

    private static async Task<SseEvent?> ReadEventAsync(StreamReader reader, TimeSpan timeout)
    {
        using var cts = new CancellationTokenSource(timeout);
        string? eventName = null;
        var data = new StringBuilder();
        while (true)
        {
            var line = await reader.ReadLineAsync(cts.Token);
            if (line is null) return null;
            if (line.Length == 0)
            {
                if (eventName is null && data.Length == 0) continue;
                return new SseEvent(eventName ?? "message", data.ToString());
            }
            if (line.StartsWith("event:")) eventName = line[6..].Trim();
            else if (line.StartsWith("data:")) data.Append(line[5..].TrimStart());
        }
    }

    private static async Task<SseEvent?> ReadUntilAsync(StreamReader reader, string eventName, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            var sse = await ReadEventAsync(reader, deadline - DateTime.UtcNow);
            if (sse is null) return null;
            if (sse.Event == eventName) return sse;
        }
        return null;
    }

    [Fact]
    public async Task Get_WhenAnonymous_ShouldAnswerUnauthorizedWithEmptyBody()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();

        using var response = await OpenStreamAsync(client, null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Get_WithTokenExpiredInsideTheClockSkew_ShouldAnswerUnauthorized()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();

        using var response = await OpenStreamAsync(client, CreateToken(Guid.NewGuid(), TimeSpan.FromMinutes(-1)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Get_WithValidToken_ShouldStreamTheConnectedEventAtOnce()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();

        using var response = await OpenStreamAsync(client, CreateToken(Guid.NewGuid(), TimeSpan.FromMinutes(15)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        var first = await ReadEventAsync(reader, ReadTimeout);
        Assert.Equal(new SseEvent(PushTopics.Connected, "{}"), first);
    }

    [Fact]
    public async Task Get_ShouldSendPingsAtTheHeartbeat()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var response = await OpenStreamAsync(client, CreateToken(Guid.NewGuid(), TimeSpan.FromMinutes(15)));
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        await ReadEventAsync(reader, ReadTimeout);

        var ping = await ReadEventAsync(reader, ReadTimeout);

        Assert.Equal(new SseEvent(PushTopics.Ping, "{}"), ping);
    }

    [Fact]
    public async Task Get_ShouldForwardNudgesPublishedThroughTheIntegrationEventPublisher()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        var userId = Guid.NewGuid();
        using var response = await OpenStreamAsync(client, CreateToken(userId, TimeSpan.FromMinutes(15)));
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        await ReadEventAsync(reader, ReadTimeout);

        using (var scope = factory.Services.CreateScope())
        {
            var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();
            var locked = new FundsLockedEvent(Guid.NewGuid(), Guid.NewGuid(), userId, 20m);
            await publisher.PublishAsync(Guid.NewGuid(), nameof(FundsLockedEvent), JsonSerializer.Serialize(locked), CancellationToken.None);
        }

        var nudge = await ReadUntilAsync(reader, PushTopics.WalletChanged, ReadTimeout);
        Assert.Equal(new SseEvent(PushTopics.WalletChanged, "{}"), nudge);
    }

    [Fact]
    public async Task Get_WhenTheTokenExpiresSoon_ShouldEndTheStreamAtTheExpiry()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var response = await OpenStreamAsync(client, CreateToken(Guid.NewGuid(), TimeSpan.FromSeconds(2)));
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        Assert.Equal(PushTopics.Connected, (await ReadEventAsync(reader, ReadTimeout))?.Event);

        var started = DateTime.UtcNow;
        SseEvent? last = null;
        while (DateTime.UtcNow - started < TimeSpan.FromSeconds(6))
        {
            var sse = await ReadEventAsync(reader, TimeSpan.FromSeconds(6));
            if (sse is null) break;
            last = sse;
        }

        Assert.Equal(PushTopics.Ping, last?.Event);
        Assert.InRange(DateTime.UtcNow - started, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Get_WhenTheHostStops_ShouldEndTheStreamPromptly()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var response = await OpenStreamAsync(client, CreateToken(Guid.NewGuid(), TimeSpan.FromMinutes(15)));
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        Assert.Equal(PushTopics.Connected, (await ReadEventAsync(reader, ReadTimeout))?.Event);

        var started = DateTime.UtcNow;
        factory.Services.GetRequiredService<IHostApplicationLifetime>().StopApplication();
        SseEvent? sse;
        do
        {
            sse = await ReadEventAsync(reader, ReadTimeout);
        } while (sse is not null);

        Assert.InRange(DateTime.UtcNow - started, TimeSpan.Zero, TimeSpan.FromSeconds(3));
    }
}
