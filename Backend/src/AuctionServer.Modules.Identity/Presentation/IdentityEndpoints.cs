using AuctionServer.Modules.Identity.Application.Commands.Login;
using AuctionServer.Modules.Identity.Application.Commands.Logout;
using AuctionServer.Modules.Identity.Application.Commands.RefreshSession;
using AuctionServer.Modules.Identity.Application.Commands.Register;
using AuctionServer.Modules.Identity.Application.Commands.RegisterBot;
using AuctionServer.Modules.Identity.Presentation.Request;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace AuctionServer.Modules.Identity.Presentation;

public static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users");

        group.MapPost("/register", async (RegisterRequest request, ISender sender) =>
        {
            await sender.Send(new RegisterCommand(request.Email, request.Password, request.Username, request.Name,
                request.Surname, request.Birthday));
            return Results.Created();
        });

        group.MapPost("/login", async (LoginRequest request, ISender sender) =>
            Results.Ok(await sender.Send(new LoginCommand(request.Email, request.Password))));

        group.MapPost("/refresh", async (RefreshTokenRequest request, ISender sender) =>
            Results.Ok(await sender.Send(new RefreshSessionCommand(request.RefreshToken))));

        group.MapPost("/logout", async (RefreshTokenRequest request, ISender sender) =>
        {
            await sender.Send(new LogoutCommand(request.RefreshToken));
            return Results.Ok();
        });
        
        group.MapPost("/bots", async (RegisterBotRequest request, ISender sender) =>
        {
            var id = await sender.Send(new RegisterBotCommand(request.Email, request.Password, request.Username, 
                request.Name, request.Surname, request.Birthday));
            return Results.Created($"/api/users/{id}", new { PublicUserId = id });
        }).RequireAuthorization("BotProvisioning");
        
        return app;
    }
}