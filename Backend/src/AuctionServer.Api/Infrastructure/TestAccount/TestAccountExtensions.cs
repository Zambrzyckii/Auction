namespace AuctionServer.Api.Infrastructure.TestAccount;

public static class TestAccountExtensions
{
    public static WebApplicationBuilder AddTestAccount(this WebApplicationBuilder builder)
    {
        var options = TestAccountOptions.Load(builder.Configuration);

        if (!options.Enabled) return builder;

        builder.Services.AddSingleton(options);
        builder.Services.AddHostedService<TestAccountSeeder>();

        return builder;
    }
}
