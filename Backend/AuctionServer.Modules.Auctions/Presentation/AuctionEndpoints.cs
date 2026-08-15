using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using MediatR;
using AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;
using AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;
using AuctionServer.Modules.Auctions.Presentation.Request;

namespace AuctionServer.Modules.Auctions.Presentation;

public static class AuctionEndpoints
{
    public static IEndpointRouteBuilder MapAuctionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auctions");

        group.MapGet("/", async (int limit, ISender sender) =>
        {
            if (limit is < 1 or > 100) return Results.BadRequest(new { Error = "Limit must be between 1 and 100" });
            var result = await sender.Send(new GetActiveAuctionsQuery(limit));
            return Results.Ok(result);
        });

        group.MapPost("/{id:guid}/bid", async (Guid id, PlaceBidRequest request, ISender sender) =>
        {
            await sender.Send(new PlaceBidCommand(id, request.BidderId, request.Amount));
            return Results.Ok();
        });

        return app;
    }
}