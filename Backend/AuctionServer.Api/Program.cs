using MediatR;
using AuctionServer.Modules.Auctions;
using AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;
using AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(AuctionModuleExtensions).Assembly));
builder.Services.AddAuctionModule(connectionString);


var app = builder.Build();


app.MapGet("/api/auctions", async (int limit, ISender sender) => 
{
    var result = await sender.Send(new GetActiveAuctionsQuery(limit));
    return Results.Ok(result);
});

app.MapPost("/api/auctions/{id}/bid", async (Guid id, decimal amount, ISender sender) => 
{
    await sender.Send(new PlaceBidCommand(id, amount));
    return Results.Ok();
});

app.Run();

