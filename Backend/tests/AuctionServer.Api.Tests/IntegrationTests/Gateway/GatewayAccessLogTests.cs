using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

[Collection(GatewayCollection.Name)]
public class GatewayAccessLogTests(GatewayFixture gateway) : IClassFixture<GatewayFixture>
{
    private async Task<string> WaitForLogLineAsync(string marker)
    {
        var lines = Array.Empty<string>();

        for (var attempt = 0; attempt < 50; attempt++)
        {
            lines = await gateway.GetAccessLogAsync();
            var line = lines.FirstOrDefault(entry => entry.Contains(marker));
            if (line is not null)
                return line;

            await Task.Delay(100);
        }

        throw new TimeoutException($"No access log line contains '{marker}'. Last lines:\n{string.Join('\n', lines.TakeLast(3))}");
    }

    [Fact]
    public async Task AccessLog_WhenNginxAnswersItself_ShouldStillBeValidJson()
    {
        using var client = gateway.CreateClient();
        var marker = Guid.NewGuid().ToString("N");

        using var response = await client.GetAsync($"/?trace={marker}");

        await WaitForLogLineAsync(marker);
        Assert.All(await gateway.GetAccessLogAsync(), line => JsonDocument.Parse(line).Dispose());
    }

    [Fact]
    public async Task AccessLog_ShouldDescribeRequestWithIdSentUpstream()
    {
        using var client = gateway.CreateClient();
        var marker = Guid.NewGuid().ToString("N");
        var path = $"/api/auctions?trace={marker}";

        var upstream = UpstreamRequest.Parse(await client.GetStringAsync(path));

        using var log = JsonDocument.Parse(await WaitForLogLineAsync(marker));
        var entry = log.RootElement;
        Assert.True(DateTimeOffset.TryParse(entry.GetProperty("time").GetString(), out _));
        Assert.True(IPAddress.TryParse(entry.GetProperty("remote_addr").GetString(), out _));
        Assert.Equal("GET", entry.GetProperty("method").GetString());
        Assert.Equal(path, entry.GetProperty("uri").GetString());
        Assert.Equal(JsonValueKind.Number, entry.GetProperty("status").ValueKind);
        Assert.Equal(200, entry.GetProperty("status").GetInt32());
        Assert.Equal(JsonValueKind.Number, entry.GetProperty("request_time").ValueKind);
        Assert.Equal(JsonValueKind.String, entry.GetProperty("upstream_response_time").ValueKind);
        Assert.Equal(upstream.Header("X-Request-Id"), entry.GetProperty("request_id").GetString());
    }

    [Fact]
    public async Task AccessLog_ShouldNeverContainAuthorization()
    {
        using var client = gateway.CreateClient();
        var marker = Guid.NewGuid().ToString("N");
        var secret = $"secret-{Guid.NewGuid():N}";
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/auctions?trace={marker}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", secret);

        using var response = await client.SendAsync(request);

        await WaitForLogLineAsync(marker);
        Assert.DoesNotContain(await gateway.GetAccessLogAsync(), line => line.Contains(secret));
    }
}
