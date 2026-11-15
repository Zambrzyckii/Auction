using AuctionServer.Modules.Profiles.Application.Queries.GetProfileSummaries;
using AuctionServer.Modules.Profiles.Application.Queries.SearchProfiles;

namespace AuctionServer.Modules.Profiles.Tests.Application;

public class ProfileQueryValidatorTests
{
    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(50, true)]
    [InlineData(51, false)]
    public void GetProfileSummaries_ShouldAcceptBetweenOneAndFiftyIds(int count, bool expected)
    {
        var userIds = Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToList();

        var result = new GetProfileSummariesQueryValidator().Validate(new GetProfileSummariesQuery(userIds));

        Assert.Equal(expected, result.IsValid);
    }

    [Theory]
    [InlineData("a", false)]
    [InlineData(" a ", false)]
    [InlineData("ab", true)]
    [InlineData("  ab  ", true)]
    public void SearchProfiles_ShouldRequireAtLeastTwoCharactersAfterTrimming(string query, bool expected)
    {
        var result = new SearchProfilesQueryValidator().Validate(new SearchProfilesQuery(query, 20));

        Assert.Equal(expected, result.IsValid);
    }

    [Theory]
    [InlineData(32, true)]
    [InlineData(33, false)]
    public void SearchProfiles_ShouldCapTheQueryAtThirtyTwoCharacters(int length, bool expected)
    {
        var result = new SearchProfilesQueryValidator().Validate(new SearchProfilesQuery(new string('a', length), 20));

        Assert.Equal(expected, result.IsValid);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(20, true)]
    [InlineData(21, false)]
    public void SearchProfiles_ShouldAcceptLimitBetweenOneAndTwenty(int limit, bool expected)
    {
        var result = new SearchProfilesQueryValidator().Validate(new SearchProfilesQuery("ab", limit));

        Assert.Equal(expected, result.IsValid);
    }
}
