using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using AuctionServer.Modules.Wallets.Application.Queries.GetWallet;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

public class WalletApiSmokeTests(CustomApi factory) : IClassFixture<CustomApi>
{
    [Fact]
    public async Task GetWallet_WhenWalletExists_ShouldReturnOkWithFunds()
    {
        var userId = await SeedWalletAsync(250m);
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/api/wallets/{userId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<WalletDto>();
        Assert.NotNull(dto);
        Assert.Equal(250m, dto.AvailableFunds);
        Assert.Equal(0m, dto.LockedFunds);
    }

    [Fact]
    public async Task AddFunds_WhenWalletExists_ShouldIncreaseAvailableFunds()
    {
        var userId = await SeedWalletAsync(100m);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateTokenFor(userId));

        var postResponse = await client.PostAsJsonAsync("/api/wallets/funds", new { amount = 150m });

        Assert.Equal(HttpStatusCode.OK, postResponse.StatusCode);
        var dto = await client.GetFromJsonAsync<WalletDto>($"/api/wallets/{userId}");
        Assert.NotNull(dto);
        Assert.Equal(250m, dto.AvailableFunds);
        Assert.Equal(0m, dto.LockedFunds);
    }

    [Fact]
    public async Task AddFunds_WhenCallerIsNotBot_ShouldReturnForbiddenAndChangeNothing()
    {
        var userId = await SeedWalletAsync(100m);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateTokenFor(userId, role: "User"));

        var postResponse = await client.PostAsJsonAsync("/api/wallets/funds", new { amount = 150m });

        Assert.Equal(HttpStatusCode.Forbidden, postResponse.StatusCode);
        var dto = await client.GetFromJsonAsync<WalletDto>($"/api/wallets/{userId}");
        Assert.NotNull(dto);
        Assert.Equal(100m, dto.AvailableFunds);
    }

    private static string CreateTokenFor(Guid userId, string role = "Bot")
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(CustomApi.TestJwtKey);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)]),
            Issuer = "AuctionServer",
            Audience = "AuctionServer.Client",
            Expires = DateTime.UtcNow.AddMinutes(15),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        return tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));
    }

    private async Task<Guid> SeedWalletAsync(decimal availableFunds)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<WalletDbContext>();
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(availableFunds);
        context.Wallets.Add(wallet);
        await context.SaveChangesAsync();
        return wallet.UserId;
    }
}
