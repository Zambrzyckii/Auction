using AuctionServer.Modules.Auctions;
using AuctionServer.Modules.Auctions.Presentation;
using AuctionServer.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(AuctionModuleExtensions).Assembly));
builder.Services.AddAuctionModule(connectionString!);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.MapAuctionEndpoints();

app.Run();

