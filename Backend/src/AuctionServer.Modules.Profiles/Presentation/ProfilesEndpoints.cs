using System.Security.Claims;
using AuctionServer.Modules.Profiles.Application.Command.AcceptFriendRequest;
using AuctionServer.Modules.Profiles.Application.Command.CreateWarehouseInvite;
using AuctionServer.Modules.Profiles.Application.Command.DeclineFriendRequest;
using AuctionServer.Modules.Profiles.Application.Command.DeleteAvatar;
using AuctionServer.Modules.Profiles.Application.Command.RemoveFriend;
using AuctionServer.Modules.Profiles.Application.Command.ReplaceSocialLinks;
using AuctionServer.Modules.Profiles.Application.Command.RequestFriendship;
using AuctionServer.Modules.Profiles.Application.Command.UploadAvatar;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Application.Queries.GetAvatar;
using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetWarehouseInvites;
using AuctionServer.Modules.Profiles.Presentation.Request;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

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

        group.MapPut("/me/socials", async (ReplaceSocialLinksRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new ReplaceSocialLinksCommand(userId, request.Links));
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPut("/me/avatar", async (HttpContext http, ClaimsPrincipal user, ISender sender) =>
        {
            var options = http.RequestServices.GetRequiredService<ProfilesOptions>();
            var feature = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (feature is not null && !feature.IsReadOnly)
                feature.MaxRequestBodySize = options.Avatar.MaxBytes + 8192;

            var form = await http.Request.ReadFormAsync();
            var file = form.Files.GetFile("file");
            if (file is null) return Results.BadRequest(new { Error = "Multipart field 'file' is required" });

            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer);
            await sender.Send(new UploadAvatarCommand(userId, buffer.ToArray()));
            return Results.Ok();
        }).RequireAuthorization();

        group.MapDelete("/me/avatar", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new DeleteAvatarCommand(userId));
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPost("/friends/requests", async (FriendRequestRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new RequestFriendshipCommand(userId, request.UserId));
            return Results.Created($"/api/profiles/friends/requests/{result.PublicFriendshipId}", result);
        }).RequireAuthorization();

        group.MapPost("/friends/requests/{publicFriendshipId:guid}/accept",
            async (Guid publicFriendshipId, ClaimsPrincipal user, ISender sender) =>
            {
                var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
                await sender.Send(new AcceptFriendRequestCommand(userId, publicFriendshipId));
                return Results.Ok();
            }).RequireAuthorization();

        group.MapPost("/friends/requests/{publicFriendshipId:guid}/decline",
            async (Guid publicFriendshipId, ClaimsPrincipal user, ISender sender) =>
            {
                var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
                await sender.Send(new DeclineFriendRequestCommand(userId, publicFriendshipId));
                return Results.Ok();
            }).RequireAuthorization();

        group.MapDelete("/friends/{userId:guid}", async (Guid userId, ClaimsPrincipal user, ISender sender) =>
        {
            var callerId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new RemoveFriendCommand(callerId, userId));
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPost("/warehouse-invites", async (WarehouseInviteRequest request, ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await sender.Send(new CreateWarehouseInviteCommand(userId, request.FriendUserId, request.PublicWarehouseId));
            return Results.Created("/api/profiles/warehouse-invites", null);
        }).RequireAuthorization();

        group.MapGet("/warehouse-invites", async (ClaimsPrincipal user, ISender sender) =>
        {
            var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await sender.Send(new GetWarehouseInvitesQuery(userId));
            return Results.Ok(result);
        }).RequireAuthorization();

        group.MapGet("/{publicUserId:guid}/avatar", async (Guid publicUserId, HttpContext http, ISender sender) =>
        {
            var result = await sender.Send(new GetAvatarQuery(publicUserId));
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            http.Response.Headers.ETag = $"\"{result.Hash}\"";
            http.Response.Headers.CacheControl = "private, max-age=86400";
            return Results.Stream(result.Content, result.ContentType);
        }).RequireAuthorization();

        group.MapGet("/{publicUserId:guid}", async (Guid publicUserId, ISender sender) =>
        {
            var result = await sender.Send(new GetProfileQuery(publicUserId));
            return Results.Ok(result);
        }).RequireAuthorization();

        return app;
    }
}
