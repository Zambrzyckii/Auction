using AuctionServer.Modules.Identity.Application.Commands.RegisterBot;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class RegisterBotCommandValidatorTests
{
    private readonly RegisterBotCommandValidator _validator = new();

    private static RegisterBotCommand ValidCommand(
        string email = "bot@test.com",
        string password = "Password123!",
        string username = "bot-one",
        string name = "Bot",
        string surname = "One",
        DateOnly? birthday = null) =>
        new(email, password, username, name, surname, birthday ?? new DateOnly(2000, 1, 1));

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(ValidCommand());

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Validate_WhenEmailIsInvalid_ShouldFail(string email)
    {
        var result = _validator.Validate(ValidCommand(email: email));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("Pw1!")]            // shorter than 8
    [InlineData("password123!")]    // no uppercase letter
    [InlineData("PASSWORD123!")]    // no lowercase letter
    [InlineData("Password!!!!")]    // no digit
    [InlineData("Password1234")]    // no special character
    public void Validate_WhenPasswordIsTooWeak_ShouldFail(string password)
    {
        var result = _validator.Validate(ValidCommand(password: password));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenUsernameIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(ValidCommand(username: ""));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenUsernameIsTooLong_ShouldFail()
    {
        var result = _validator.Validate(ValidCommand(username: new string('a', 31)));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenBirthdayIsInTheFuture_ShouldFail()
    {
        var future = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));

        var result = _validator.Validate(ValidCommand(birthday: future));

        Assert.False(result.IsValid);
    }
}
