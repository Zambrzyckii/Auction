namespace AuctionServer.Api.Infrastructure.TestAccount;

public sealed class TestAccountOptions
{
    public const int MaxCopies = 5;

    public bool Enabled { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public decimal Funds { get; init; }
    public int Copies { get; init; }

    public static TestAccountOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("TestAccount").Get<TestAccountOptions>() ?? new TestAccountOptions();

        if (!options.Enabled) return options;

        RequireValue(options.Email, "Email");
        RequireValue(options.Username, "Username");
        RequireValue(options.Password, "Password");

        if (options.Funds <= 0)
            throw new InvalidOperationException("TestAccount:Funds must be greater than zero when the test account is enabled");

        if (options.Copies is < 1 or > MaxCopies)
            throw new InvalidOperationException(
                $"TestAccount:Copies must be between 1 and {MaxCopies} when the test account is enabled");

        return options;
    }

    private static void RequireValue(string value, string key)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException($"TestAccount:{key} must not be empty when the test account is enabled");
    }
}
