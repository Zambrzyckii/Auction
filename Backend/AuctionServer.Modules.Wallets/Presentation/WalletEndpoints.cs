using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using MediatR;
using AuctionServer.Modules.Wallets.Application.Command.AddFunds;
using AuctionServer.Modules.Wallets.Application.Queries.GetWallet;
using AuctionServer.Modules.Wallets.Presentation.Request;

namespace AuctionServer.Modules.Wallets.Presentation;

public static class WalletEndpoints
{
    public static IEndpointRouteBuilder MapWalletEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/wallets");

        group.MapGet("/{id:guid}", async (Guid id, ISender sender) =>
        {
            var result = await sender.Send(new GetWalletQuery(id));
            return Results.Ok(result);
        });

        group.MapPost("/funds", async (AddFundsRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new AddFundsCommand(userId, request.Amount));
            return Results.Ok();
        }).RequireAuthorization();

        return app;
    }
}