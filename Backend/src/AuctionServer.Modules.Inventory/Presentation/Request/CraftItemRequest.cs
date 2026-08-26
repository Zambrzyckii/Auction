namespace AuctionServer.Modules.Inventory.Presentation.Request;

public record CraftItemRequest(IReadOnlyList<Guid> IngredientsIds);