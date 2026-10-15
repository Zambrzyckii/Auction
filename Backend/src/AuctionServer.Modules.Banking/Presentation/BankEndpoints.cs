using System.Security.Claims;
using AuctionServer.Modules.Banking.Application.Command.CreateLoan;
using AuctionServer.Modules.Banking.Application.Command.RepayLoan;
using AuctionServer.Modules.Banking.Application.Queries.GetLoans;
using AuctionServer.Modules.Banking.Application.Queries.GetOffers;
using AuctionServer.Modules.Banking.Presentation.Request;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Banking.Presentation;

public static class BankEndpoints
{
    public static IEndpointRouteBuilder MapBankEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/bank");

        group.MapGet("/offers", async (ISender sender) =>
        {
            var result = await sender.Send(new GetOffersQuery());
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/loans", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetLoansQuery(userId));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapPost("/loans", async (CreateLoanRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var id = await sender.Send(new CreateLoanCommand(userId, request.OfferName));
            return Results.Created($"/api/bank/loans/{id}", new { PublicLoanId = id });
        }).RequireAuthorization();

        group.MapPost("/loans/{publicLoanId:guid}/repayments", async (Guid publicLoanId, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new RepayLoanCommand(userId, publicLoanId));
            return Results.Accepted();
        }).RequireAuthorization();

        return app;
    }
}
