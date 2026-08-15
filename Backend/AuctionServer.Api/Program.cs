using System.Text;
using AuctionServer.Modules.Auctions;
using AuctionServer.Modules.Auctions.Presentation;
using AuctionServer.Api.Infrastructure;
using AuctionServer.Modules.Identity;
using AuctionServer.Modules.Identity.Presentation;
using AuctionServer.Modules.Wallets;
using AuctionServer.Modules.Wallets.Presentation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"]
    });

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(AuctionModuleExtensions).Assembly));
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(WalletModuleExtensions).Assembly));
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(IdentityModuleExtensions).Assembly));
builder.Services.AddAuctionModule(connectionString!);
builder.Services.AddWalletsModule(connectionString!);
builder.Services.AddIdentityModule(connectionString!);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.MapAuctionEndpoints();
app.MapWalletEndpoints();
app.MapIdentityEndpoints();

app.Run();

public partial class Program;

