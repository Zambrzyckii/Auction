using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Queries.SearchProfiles;

public sealed class SearchProfilesQueryValidator : AbstractValidator<SearchProfilesQuery>
{
    public const int MinQueryLength = 2;
    public const int MaxQueryLength = 32;
    public const int MaxLimit = 20;

    public SearchProfilesQueryValidator()
    {
        RuleFor(x => x.Query).NotNull();
        RuleFor(x => x.Query.Trim())
            .Length(MinQueryLength, MaxQueryLength)
            .WithName("Query")
            .When(x => x.Query is not null);
        RuleFor(x => x.Limit).InclusiveBetween(1, MaxLimit);
    }
}
