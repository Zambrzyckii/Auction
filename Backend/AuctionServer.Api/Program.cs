using AuctionServer.Modules.Auctions;
using AuctionServer.Modules.Auctions.Presentation;
using AuctionServer.Api.Infrastructure;
using AuctionServer.Modules.Wallets;
using AuctionServer.Modules.Wallets.Presentation;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(AuctionModuleExtensions).Assembly));
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(WalletModuleExtensions).Assembly));
builder.Services.AddAuctionModule(connectionString!);
builder.Services.AddWalletsModule(connectionString!);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.MapAuctionEndpoints();
app.MapWalletEndpoints();

app.Run();

public partial class Program;

