using System.Text.Json;

namespace AuctionServer.Api.Infrastructure.Push;

public sealed record PushMessage(string Topic, string Data)
{
    private const string NoData = "{}";

    public static PushMessage Of(string topic) => new(topic, NoData);

    public static PushMessage AuctionChanged(Guid auctionId) =>
        new(PushTopics.AuctionChanged, JsonSerializer.Serialize(new { auctionId }, JsonSerializerOptions.Web));

    public static PushMessage WarehouseChanged(Guid warehouseId) =>
        new(PushTopics.WarehouseChanged, JsonSerializer.Serialize(new { warehouseId }, JsonSerializerOptions.Web));
}
