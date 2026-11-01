using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public static class DeliveryCourier
{
    public static async Task<List<DeliveryMessage>> ClaimAsync(
        DbContext context, int batchSize, CancellationToken cancellationToken)
    {
        var table = TableName(context);
        var claim = $"""
            UPDATE "{table}" SET "LeasedUntil" = now() + interval '30 seconds'
            WHERE ("MessageId", "Recipient") IN (
                SELECT "MessageId", "Recipient" FROM "{table}"
                WHERE "ProcessedOn" IS NULL AND NOT "IsDead"
                  AND ("NextAttemptOn" IS NULL OR "NextAttemptOn" <= now())
                  AND ("LeasedUntil" IS NULL OR "LeasedUntil" <= now())
                ORDER BY "CreatedOn", "Position"
                LIMIT {batchSize}
                FOR UPDATE SKIP LOCKED)
            RETURNING *
            """;
        var claimed = await context.Set<DeliveryMessage>().FromSqlRaw(claim).ToListAsync(cancellationToken);
        return claimed.OrderBy(m => m.CreatedOn).ThenBy(m => m.Position).ToList();
    }

    public static async Task<int> CleanupAsync(
        DbContext context, TimeSpan retention, CancellationToken cancellationToken)
    {
        var table = TableName(context);
        var cutoff = DateTime.UtcNow - retention;
        var sql = $$"""DELETE FROM "{{table}}" WHERE "ProcessedOn" IS NOT NULL AND "ProcessedOn" < {0}""";
        return await context.Database.ExecuteSqlRawAsync(sql, [cutoff], cancellationToken);
    }

    private static string TableName(DbContext context)
        => context.Model.FindEntityType(typeof(DeliveryMessage))!.GetTableName()!;
}
