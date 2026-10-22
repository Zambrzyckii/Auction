using System.Security.Claims;
using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetProfile;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Profiles.Presentation;

public static class ProfilesEndpoints
{
    public static IEndpointRouteBuilder MapProfilesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles");

        group.MapGet("/me", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetOwnProfileQuery(userId));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/{publicUserId:guid}", async (Guid publicUserId, ISender sender) =>
        {
            var result = await sender.Send(new GetProfileQuery(publicUserId));
            return Results.Ok(result);
        }).RequireAuthorization();

        return app;
    }
}
