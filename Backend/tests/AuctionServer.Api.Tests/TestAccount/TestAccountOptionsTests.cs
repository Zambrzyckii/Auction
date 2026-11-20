using AuctionServer.Api.Infrastructure.TestAccount;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.TestAccount;

public class TestAccountOptionsTests
{
    private static readonly (string Key, string Value)[] ValidPairs =
    [
        ("Enabled", "true"),
        ("Email", "tester@example.com"),
        ("Username", "Tester"),
        ("Password", "Tester123!"),
        ("Funds", "10000000"),
        ("Copies", "1")
    ];

    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"TestAccount:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    private static IConfiguration ValidWith(string key, string value)
    {
        return BuildConfiguration(ValidPairs.Where(p => p.Key != key).Append((key, value)).ToArray());
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldReturnDisabledOptions()
    {
        var options = TestAccountOptions.Load(new ConfigurationBuilder().Build());

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WhenDisabled_ShouldSkipValidation()
    {
        var options = TestAccountOptions.Load(BuildConfiguration(("Enabled", "false"), ("Copies", "0")));

        Assert.False(options.Enabled);
    }

    [Fact]
    public void Load_WhenEnabledAndValid_ShouldReturnOptions()
    {
        var options = TestAccountOptions.Load(BuildConfiguration(ValidPairs));

        Assert.True(options.Enabled);
        Assert.Equal("tester@example.com", options.Email);
        Assert.Equal("Tester", options.Username);
        Assert.Equal("Tester123!", options.Password);
        Assert.Equal(10_000_000m, options.Funds);
        Assert.Equal(1, options.Copies);
    }

    [Theory]
    [InlineData("Email")]
    [InlineData("Username")]
    [InlineData("Password")]
    public void Load_WhenEnabledWithEmptyCredential_ShouldThrow(string key)
    {
        var exception = Assert.Throws<InvalidOperationException>(() => TestAccountOptions.Load(ValidWith(key, " ")));

        Assert.Contains($"TestAccount:{key}", exception.Message);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    public void Load_WhenEnabledWithoutPositiveFunds_ShouldThrow(string funds)
    {
        var exception = Assert.Throws<InvalidOperationException>(() => TestAccountOptions.Load(ValidWith("Funds", funds)));

        Assert.Contains("TestAccount:Funds", exception.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(TestAccountOptions.MaxCopies + 1)]
    public void Load_WhenEnabledWithCopiesOutOfRange_ShouldThrow(int copies)
    {
        var configuration = ValidWith("Copies", copies.ToString());

        var exception = Assert.Throws<InvalidOperationException>(() => TestAccountOptions.Load(configuration));

        Assert.Contains("TestAccount:Copies", exception.Message);
    }
}
