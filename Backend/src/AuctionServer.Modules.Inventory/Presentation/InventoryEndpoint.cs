using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Inventory.Presentation;

public static class InventoryEndpoint
{
    public static IEndpointRouteBuilder MapInventoryEnpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/inventory");
        return app;
    }
}