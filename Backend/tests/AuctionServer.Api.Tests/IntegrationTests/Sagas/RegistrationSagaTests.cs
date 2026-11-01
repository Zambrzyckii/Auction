using System.Net;
using System.Net.Http.Json;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Api.Tests.IntegrationTests.Sagas;

[Collection(SagaStageCollection.Name)]
public class RegistrationSagaTests(SagaStageFixture stage)
{
    [Fact]
    public async Task Register_ShouldCreateWalletStarterPackAndProfile()
    {
        var unique = Guid.NewGuid().ToString("N");
        var email = $"{unique}@saga.test";
        var username = $"saga{unique[..8]}";
        var client = stage.Factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/users/register", new
        {
            Email = email,
            Password = "Password1!",
            Username = username,
            Name = "Saga",
            Surname = "Player",
            Birthday = "2000-01-01"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        await stage.WaitForOutboxQuietAsync();

        using var scope = stage.Factory.Services.CreateScope();
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var user = await identity.Users.AsNoTracking().SingleAsync(u => u.Email == email);

        var wallets = scope.ServiceProvider.GetRequiredService<WalletDbContext>();
        var wallet = await wallets.Wallets.AsNoTracking().SingleAsync(w => w.UserId == user.PublicUserId);
        Assert.Equal(300m, wallet.AvailableFunds);

        var inventory = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
        var items = await inventory.Items.AsNoTracking().Where(i => i.OwnerUserId == user.PublicUserId).ToListAsync();
        Assert.Equal(3, items.Count);

        var profiles = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        var profile = await profiles.UserProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.PublicUserId);
        Assert.Equal(username, profile.Username);
    }
}
