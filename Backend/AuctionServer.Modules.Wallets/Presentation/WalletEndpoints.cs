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

        group.MapPost("/{id:guid}/funds", async (Guid id, AddFundsRequest request, ISender sender) =>
        {
            await sender.Send(new AddFundsCommand(id, request.Amount));
            return Results.Ok();
        });

        return app;
    }
}