using System.Security.Claims;
using AuctionServer.Modules.Pawnshop.Application.Command.BuyBot;
using AuctionServer.Modules.Pawnshop.Application.Command.OpenPawnshop;
using AuctionServer.Modules.Pawnshop.Application.Command.WithdrawStockItem;
using AuctionServer.Modules.Pawnshop.Application.Queries.GetOffers;
using AuctionServer.Modules.Pawnshop.Application.Queries.GetPawnshop;
using AuctionServer.Modules.Pawnshop.Presentation.Request;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Pawnshop.Presentation;

public static class PawnshopEndpoints
{
    public static IEndpointRouteBuilder MapPawnshopEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/pawnshop");

        group.MapGet("/offers", async (ISender sender) =>
        {
            var result = await sender.Send(new GetOffersQuery());
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetPawnshopQuery(userId));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapPost("/", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var id = await sender.Send(new OpenPawnshopCommand(userId));
            return Results.Created("/api/pawnshop", new { PublicPawnshopId = id });
        }).RequireAuthorization();

        group.MapPost("/bot", async (BuyBotRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new BuyBotCommand(userId, request.TierName));
            return Results.Accepted();
        }).RequireAuthorization();

        group.MapPost("/stock/{publicStockItemId:guid}/withdraw", async (Guid publicStockItemId, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new WithdrawStockItemCommand(userId, publicStockItemId));
            return Results.Accepted();
        }).RequireAuthorization();

        return app;
    }
}
