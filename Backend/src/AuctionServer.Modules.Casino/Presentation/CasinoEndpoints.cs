using System.Security.Claims;
using AuctionServer.Modules.Casino.Application.Command.CashOutChips;
using AuctionServer.Modules.Casino.Application.Command.PurchaseChips;
using AuctionServer.Modules.Casino.Application.Command.SpinRoulette;
using AuctionServer.Modules.Casino.Application.Queries.GetCasino;
using AuctionServer.Modules.Casino.Application.Queries.GetRouletteSpins;
using AuctionServer.Modules.Casino.Presentation.Request;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Casino.Presentation;

public static class CasinoEndpoints
{
    public static IEndpointRouteBuilder MapCasinoEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/casino");

        group.MapGet("/", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetCasinoQuery(userId));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapPost("/chips/purchases", async (PurchaseChipsRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var id = await sender.Send(new PurchaseChipsCommand(userId, request.Amount));
            return Results.Created("/api/casino", new { PublicPurchaseId = id });
        }).RequireAuthorization();

        group.MapPost("/chips/cashouts", async (CashOutChipsRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new CashOutChipsCommand(userId, request.Amount));
            return Results.Accepted();
        }).RequireAuthorization();

        group.MapPost("/roulette/spins", async (SpinRouletteRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new SpinRouletteCommand(userId, request.Bets));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/roulette/spins", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetRouletteSpinsQuery(userId));
            return Results.Ok(result);
        }).RequireAuthorization();

        return app;
    }
}
