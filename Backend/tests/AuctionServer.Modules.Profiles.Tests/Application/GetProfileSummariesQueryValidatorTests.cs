using AuctionServer.Modules.Profiles.Application.Queries.GetProfileSummaries;

namespace AuctionServer.Modules.Profiles.Tests.Application;

public class GetProfileSummariesQueryValidatorTests
{
    private readonly GetProfileSummariesQueryValidator _validator = new();

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(50, true)]
    [InlineData(51, false)]
    public void Validate_WhenIdCountVaries_ShouldPassOnlyBetweenOneAndFifty(int count, bool expected)
    {
        var userIds = Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToList();

        var result = _validator.Validate(new GetProfileSummariesQuery(userIds));

        Assert.Equal(expected, result.IsValid);
    }
}
