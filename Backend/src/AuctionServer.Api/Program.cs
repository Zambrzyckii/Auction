using System.Globalization;
using System.Text;
using AuctionServer.Modules.Auctions;
using AuctionServer.Modules.Auctions.Presentation;
using AuctionServer.Api.Infrastructure;
using AuctionServer.Modules.Identity;
using AuctionServer.Modules.Identity.Presentation;
using AuctionServer.Modules.Inventory;
using AuctionServer.Modules.Wallets;
using AuctionServer.Modules.Wallets.Presentation;
using AuctionServer.Shared.Integration.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
ValidatorOptions.Global.LanguageManager.Culture = new CultureInfo("en");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"]
    });

builder.Services.AddAuthorization();

builder.Services.AddValidatorsFromAssembly(typeof(AuctionModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(AuctionModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(WalletModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(WalletModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(IdentityModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(IdentityModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(InventoryModuleExtension).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(InventoryModuleExtension).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddAuctionModule(connectionString!);
builder.Services.AddWalletsModule(connectionString!);
builder.Services.AddIdentityModule(connectionString!);
builder.Services.AddInventoryModule(connectionString!);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuctionEndpoints();
app.MapWalletEndpoints();
app.MapIdentityEndpoints();
app.Run();

public partial class Program;

