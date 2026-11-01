using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Delivery;

public sealed class DeliveryDispatcher(DeliveryDbContext context, DeliveryRecipientRegistry registry)
    : IIntegrationEventDispatcher
{
    public async Task AcceptAsync(Guid messageId, string type, string content, CancellationToken token)
    {
        var recipients = registry.For(type);
        if (recipients.Count == 0)
            return;

        var existing = await context.DeliveryMessages
            .Where(m => m.MessageId == messageId)
            .Select(m => m.Recipient)
            .ToListAsync(token);

        for (var position = 0; position < recipients.Count; position++)
        {
            if (existing.Contains(recipients[position].Name))
                continue;

            context.DeliveryMessages.Add(new DeliveryMessage
            {
                MessageId = messageId,
                Recipient = recipients[position].Name,
                Position = position,
                Type = type,
                Content = content
            });
        }

        await context.SaveChangesAsync(token);
    }
}
