using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
        if (await context.Set<ProcessedMessage>().AnyAsync(m => m.EventId == eventId, token)) return;

        var reply = await change();
        context.Set<ProcessedMessage>().Add(new ProcessedMessage { EventId = eventId });
        if (reply is not null) context.Set<OutboxMessage>().Add(reply);

        try
        {
            await context.SaveChangesAsync(CancellationToken.None);
        }
        catch (DbUpdateException e) when (IsInboxDuplicate(context, e))
        {
        }
    }

    private static bool IsInboxDuplicate(DbContext context, DbUpdateException e)
    {
        if (e.InnerException is not PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } postgres)
            return false;

        var primaryKey = context.Model.FindEntityType(typeof(ProcessedMessage))?.FindPrimaryKey();
        return primaryKey is not null && postgres.ConstraintName == primaryKey.GetName();
    }
}
