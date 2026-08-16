using AuctionServer.Modules.Identity.Application.Commands.Register;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class RegisterCommandValidatorTests
{
    private readonly RegisterCommandValidator _validator = new();

    private static RegisterCommand ValidCommand(
        string email = "user@test.com",
        string password = "Password123!",
        string username = "validuser",
        string name = "Jan",
        string surname = "Kowalski",
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
