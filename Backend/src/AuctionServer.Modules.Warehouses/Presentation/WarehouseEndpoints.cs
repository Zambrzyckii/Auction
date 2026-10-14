using System.Security.Claims;
using AuctionServer.Modules.Warehouses.Application.Command.JoinWarehouseWar;
using AuctionServer.Modules.Warehouses.Application.Command.LeaveWarehouseWar;
using AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouseById;
using AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouses;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Warehouses.Presentation;

public static class WarehouseEndpoints
{
    public static IEndpointRouteBuilder MapWarehouseEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/warehouses");

        group.MapGet("/", async (int limit, ISender sender) =>
        {
            if (limit is < 1 or > 100) return Results.BadRequest(new { Error = "Limit must be between 1 and 100" });
            var result = await sender.Send(new GetWarehousesQuery(limit));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal user, ISender sender) =>
        {
            var callerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetWarehouseByIdQuery(id, callerId));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapPost("/{id:guid}/join", async (Guid id, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new JoinWarehouseWarCommand(id, userId));
            return Results.Ok();
        }).RequireAuthorization();

        group.MapPost("/{id:guid}/leave", async (Guid id, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new LeaveWarehouseWarCommand(id, userId));
            return Results.Ok();
        }).RequireAuthorization();

        return app;
    }
}
