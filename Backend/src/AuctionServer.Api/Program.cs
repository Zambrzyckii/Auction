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
using AuctionServer.Modules.Casino;
using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Modules.Casino.Presentation;
using AuctionServer.Modules.Profiles;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Modules.Profiles.Presentation;
using AuctionServer.Api.Infrastructure;
using AuctionServer.Api.Infrastructure.Authentication;
using AuctionServer.Api.Infrastructure.Gateway;
using AuctionServer.Api.Infrastructure.Health;
using AuctionServer.Api.Infrastructure.Messaging;
using AuctionServer.Api.Infrastructure.Observability;
using AuctionServer.Modules.Identity;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Modules.Identity.Presentation;
using AuctionServer.Modules.Inventory;
using AuctionServer.Modules.Inventory.Application.Options;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Modules.Inventory.Presentation;
using AuctionServer.Modules.Pawnshop;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Modules.Pawnshop.Presentation;
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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("Missing configuration value 'ConnectionStrings:DefaultConnection'");
var startingFunds = builder.Configuration.GetValue<decimal?>("Wallets:StartingFunds") ?? throw new InvalidOperationException("Missing configuration value 'Wallets:StartingFunds'");
var starterItems = builder.Configuration.GetSection("Inventory:StarterItems").Get<List<StarterItemDefinition>>() ?? [];
var warehousesOptions = builder.Configuration.GetSection("Warehouses").Get<WarehousesOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Warehouses'");
var bankingOptions = builder.Configuration.GetSection("Banking").Get<BankingOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Banking'");
var pawnshopOptions = builder.Configuration.GetSection("Pawnshop").Get<PawnshopOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Pawnshop'");
var casinoOptions = builder.Configuration.GetSection("Casino").Get<CasinoOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Casino'");
var profilesOptions = builder.Configuration.GetSection("Profiles").Get<ProfilesOptions>() ?? throw new InvalidOperationException("Missing configuration section 'Profiles'");
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

builder.Services.AddValidatorsFromAssembly(typeof(PawnshopModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(PawnshopModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(CasinoModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(CasinoModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(ProfilesModuleExtensions).Assembly);
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(ProfilesModuleExtensions).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));
});

builder.Services.AddAuctionModule(connectionString);
builder.Services.AddWalletsModule(connectionString, startingFunds);
builder.Services.AddIdentityModule(connectionString);
builder.Services.AddInventoryModule(connectionString, starterItems);
builder.Services.AddWarehousesModule(connectionString, warehousesOptions);
builder.Services.AddBankingModule(connectionString, bankingOptions);
builder.Services.AddPawnshopModule(connectionString, pawnshopOptions);
builder.Services.AddCasinoModule(connectionString, casinoOptions);
builder.Services.AddProfilesModule(connectionString, profilesOptions);
builder.Services.AddSingleton<MessagingMetrics>();
builder.Services.AddScoped<InProcessEventPublisher>();
builder.Services.AddScoped<IIntegrationEventPublisher>(provider => new InstrumentedEventPublisher(
    provider.GetRequiredService<InProcessEventPublisher>(),
    provider.GetRequiredService<MessagingMetrics>()));
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()));
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: [HealthEndpoints.ReadyTag]);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.AddObservability();
builder.AddGateway();

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
    await scope.ServiceProvider.GetRequiredService<PawnshopDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<CasinoDbContext>().Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<ProfilesDbContext>().Database.MigrateAsync();
}

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapHealthEndpoints();
app.MapInventoryEndpoints();
app.MapAuctionEndpoints();
app.MapWalletEndpoints();
app.MapIdentityEndpoints();
app.MapWarehouseEndpoints();
app.MapBankEndpoints();
app.MapPawnshopEndpoints();
app.MapCasinoEndpoints();
app.MapProfilesEndpoints();
app.Run();

public partial class Program;

