using AuctionServer.Modules.Profiles.Application.Queries.SearchProfiles;

namespace AuctionServer.Modules.Profiles.Tests.Application;

public class SearchProfilesQueryValidatorTests
{
    private readonly SearchProfilesQueryValidator _validator = new();

    [Theory]
    [InlineData("a", false)]
    [InlineData(" a ", false)]
    [InlineData("ab", true)]
    [InlineData("  ab  ", true)]
    public void Validate_WhenQueryVaries_ShouldPassOnlyWithTwoCharactersAfterTrimming(string query, bool expected)
    {
        var result = _validator.Validate(new SearchProfilesQuery(query, 20));

        Assert.Equal(expected, result.IsValid);
    }

    [Theory]
    [InlineData(32, true)]
    [InlineData(33, false)]
    public void Validate_WhenQueryLengthVaries_ShouldPassOnlyUpToThirtyTwoCharacters(int length, bool expected)
    {
        var result = _validator.Validate(new SearchProfilesQuery(new string('a', length), 20));

        Assert.Equal(expected, result.IsValid);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(20, true)]
    [InlineData(21, false)]
    public void Validate_WhenLimitVaries_ShouldPassOnlyBetweenOneAndTwenty(int limit, bool expected)
    {
        var result = _validator.Validate(new SearchProfilesQuery("ab", limit));

        Assert.Equal(expected, result.IsValid);
    }
}
