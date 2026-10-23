using AuctionServer.Shared.Integration.Messaging;
using System.Diagnostics;

namespace AuctionServer.Api.Infrastructure.Messaging;

public sealed class InstrumentedEventPublisher(IIntegrationEventPublisher inner, MessagingMetrics metrics)
    : IIntegrationEventPublisher
{
    public async Task PublishAsync(Guid messageId, string type, string content, CancellationToken token)
    {
        var start = Stopwatch.GetTimestamp();
        try
        {
            await inner.PublishAsync(messageId, type, content, token);
            var elapsed = Stopwatch.GetElapsedTime(start).TotalMilliseconds;
            metrics.Published.Add(1, new KeyValuePair<string, object?>("event.type", type),
                new KeyValuePair<string, object?>("result", "ok"));
            metrics.PublishDuration.Record(elapsed, new KeyValuePair<string, object?>("event.type", type),
                new KeyValuePair<string, object?>("result", "ok"));
        }
        catch
        {
            metrics.Published.Add(1, new KeyValuePair<string, object?>("event.type", type),
                new KeyValuePair<string, object?>("result", "error"));
            throw;
        }

    }
}
