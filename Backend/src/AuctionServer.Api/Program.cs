using System.Globalization;
using System.Text;
using System.Text.Json.Serialization;
using AuctionServer.Modules.Auctions;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Modules.Auctions.Presentation;
using AuctionServer.Modules.Banking;
using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Modules.Banking.Presentation;
using AuctionServer.Api.Infrastructure;
using AuctionServer.Api.Infrastructure.Authentication;
using AuctionServer.Api.Infrastructure.Health;
using AuctionServer.Api.Infrastructure.Messaging;
using AuctionServer.Modules.Identity;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Modules.Identity.Presentation;
using AuctionServer.Modules.Inventory;
using AuctionServer.Modules.Inventory.Application.Options;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Modules.Inventory.Presentation;
using AuctionServer.Modules.Wallets;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Modules.Wallets.Presentation;
using AuctionServer.Modules.Warehouses;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using AuctionServer.Modules.Warehouses.Presentation;
using AuctionServer.Shared.Integration.Messaging;
using AuctionServer.Shared.Integration.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var startingFunds = builder.Configuration.GetValue<decimal?>("Wallets:StartingFunds") ?? throw new InvalidOperationException("Missing configuration value 'Wallets:StartingFunds'");
var starterItems = builder.Configuration.GetSection("Inventory:StarterItems").Get<List<StarterItemDefinition>>() ?? [];
var warehousesOptions = builder.Configuration.GetSection("Warehouses").Get<WarehousesOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Warehouses'");
var bankingOptions = builder.Configuration.GetSection("Banking").Get<BankingOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Banking'");
ValidatorOptions.Global.LanguageManager.Culture = new CultureInfo("en");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"]
    })
    .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(
        ApiKeyAuthenticationOptions.SchemeName, options => options.ApiKey = builder.Configuration["Bots:ApiKey"]);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Bot", policy => policy.RequireRole("Bot"));
    options.AddPolicy("BotProvisioning", policy =>
    {
        policy.AuthenticationSchemes.Add(ApiKeyAuthenticationOptions.SchemeName);
        policy.RequireAuthenticatedUser();
    });
});

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

builder.Services.AddValidatorsFromAssembly(typeof(WarehouseModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(WarehouseModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(BankingModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(BankingModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddAuctionModule(connectionString!);
builder.Services.AddWalletsModule(connectionString!, startingFunds);
builder.Services.AddIdentityModule(connectionString!);
builder.Services.AddInventoryModule(connectionString!, starterItems);
builder.Services.AddWarehousesModule(connectionString!, warehousesOptions);
builder.Services.AddBankingModule(connectionString!, bankingOptions);
builder.Services.AddScoped<IIntegrationEventPublisher, InProcessEventPublisher>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()));
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();

if (builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<IdentityDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<WalletDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<AuctionDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<InventoryDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<WarehouseDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<BankingDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapHealthChecks("/health");
app.MapInventoryEndpoints();
app.MapAuctionEndpoints();
app.MapWalletEndpoints();
app.MapIdentityEndpoints();
app.MapWarehouseEndpoints();
app.MapBankEndpoints();
app.Run();

public partial class Program;

