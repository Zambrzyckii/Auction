using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Inbox;

public static class InboxOperation
{
    public static Task ApplyOnceAsync(this DbContext context, Guid eventId, Func<Task> change,
        CancellationToken token)
    {
        return context.ApplyOnceAsync(eventId, async () =>
        {
            await change();
            return (OutboxMessage?)null;
        }, token);
    }

    public static async Task ApplyOnceAsync(this DbContext context, Guid eventId,
        Func<Task<OutboxMessage?>> change, CancellationToken token)
    {
        if (await context.WasAppliedAsync(eventId, token)) return;

        var reply = await change();
        context.Set<ProcessedMessage>().Add(new ProcessedMessage { EventId = eventId });
        if (reply is not null) context.Set<OutboxMessage>().Add(reply);

        try
        {
            await context.SaveChangesAsync(CancellationToken.None);
        }
        catch (DbUpdateException)
        {
            if (!await context.WasAppliedAsync(eventId, CancellationToken.None)) throw;
        }
    }

    private static Task<bool> WasAppliedAsync(this DbContext context, Guid eventId, CancellationToken token)
        => context.Set<ProcessedMessage>().AnyAsync(m => m.EventId == eventId, token);
}
