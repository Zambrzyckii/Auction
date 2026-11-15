using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;
using System.Security.Claims;
using System.Threading.Channels;
using Microsoft.AspNetCore.Authentication;

namespace AuctionServer.Api.Infrastructure.Push;

public static class PushEndpoints
{
    private static readonly SseItem<string> Connected = new("{}", PushTopics.Connected);
    private static readonly SseItem<string> Ping = new("{}", PushTopics.Ping);

    public static IEndpointRouteBuilder MapPushEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/push", async (
            HttpContext http,
            ClaimsPrincipal user,
            PushConnections connections,
            PushOptions options,
            IHostApplicationLifetime lifetime) =>
        {
            var authentication = await http.AuthenticateAsync();
            var tokenLifetime = RemainingLifetime(authentication.Properties?.ExpiresUtc);
            if (tokenLifetime <= TimeSpan.Zero) return Results.Unauthorized();

            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return TypedResults.ServerSentEvents(
                Stream(connections, options, userId, tokenLifetime, lifetime.ApplicationStopping));
        }).RequireAuthorization();

        return app;
    }

    private static TimeSpan? RemainingLifetime(DateTimeOffset? expiresUtc) =>
        expiresUtc is null ? null : expiresUtc.Value - DateTimeOffset.UtcNow;

    private static async IAsyncEnumerable<SseItem<string>> Stream(
        PushConnections connections,
        PushOptions options,
        Guid userId,
        TimeSpan? tokenLifetime,
        CancellationToken applicationStopping,
        [EnumeratorCancellation] CancellationToken requestAborted = default)
    {
        using var stop = CancellationTokenSource.CreateLinkedTokenSource(requestAborted, applicationStopping);
        if (tokenLifetime is not null) stop.CancelAfter(tokenLifetime.Value);
        using var subscription = connections.Subscribe(userId);

        yield return Connected;

        while (!stop.IsCancellationRequested)
        {
            var next = await NextAsync(subscription.Reader, options.Heartbeat, stop.Token);
            if (next is null) yield break;
            yield return next.Value;
        }
    }

    private static async Task<SseItem<string>?> NextAsync(
        ChannelReader<PushMessage> reader, TimeSpan heartbeat, CancellationToken stop)
    {
        using var tick = CancellationTokenSource.CreateLinkedTokenSource(stop);
        tick.CancelAfter(heartbeat);
        try
        {
            if (!await reader.WaitToReadAsync(tick.Token)) return null;

            return reader.TryRead(out var message) ? new SseItem<string>(message.Data, message.Topic) : Ping;
        }
        catch (OperationCanceledException)
        {
            return stop.IsCancellationRequested ? null : Ping;
        }
    }
}
