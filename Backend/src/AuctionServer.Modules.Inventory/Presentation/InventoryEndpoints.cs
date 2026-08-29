using System.Security.Claims;
using AuctionServer.Modules.Inventory.Application.Command.CraftItem;
using AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;
using AuctionServer.Modules.Inventory.Application.Queries.GetUserItemsQuery;
using AuctionServer.Modules.Inventory.Presentation.Request;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Inventory.Presentation;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/inventory").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetUserItemsQuery(userId));
            return Results.Ok(result);
        });
        
        group.MapPost("/craft", async (CraftItemRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var id = await sender.Send(new CraftItemCommand(userId, request.IngredientsIds));
            return Results.Created($"/api/inventory/{id}", new { PublicItemId = id });
        });

        group.MapPost("/{id:guid}/sell", async (Guid id, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new SellItemToShopCommand(userId, id));
            return Results.Ok();
        });
        return app;
    }
}