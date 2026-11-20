using AuctionServer.Api.Infrastructure.TestAccount;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AuctionServer.Api.Tests.TestAccount;

public class TestAccountExtensionsTests
{
    [Fact]
    public void AddTestAccount_WhenSectionIsMissing_ShouldNotRegisterTheSeeder()
    {
        var builder = WebApplication.CreateBuilder();

        builder.AddTestAccount();
        using var app = builder.Build();

        Assert.DoesNotContain(app.Services.GetServices<IHostedService>(), service => service is TestAccountSeeder);
        Assert.Null(app.Services.GetService<TestAccountOptions>());
    }

    [Fact]
    public void AddTestAccount_WhenEnabled_ShouldRegisterTheSeederWithItsOptions()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Configuration["TestAccount:Enabled"] = "true";
        builder.Configuration["TestAccount:Email"] = "tester@example.com";
        builder.Configuration["TestAccount:Username"] = "Tester";
        builder.Configuration["TestAccount:Password"] = "Tester123!";
        builder.Configuration["TestAccount:Funds"] = "10000000";
        builder.Configuration["TestAccount:Copies"] = "1";

        builder.AddTestAccount();
        using var app = builder.Build();

        Assert.Contains(app.Services.GetServices<IHostedService>(), service => service is TestAccountSeeder);
        Assert.Equal("tester@example.com", app.Services.GetRequiredService<TestAccountOptions>().Email);
    }
}
