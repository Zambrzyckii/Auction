using FluentValidation;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfileSummaries;

public sealed class GetProfileSummariesQueryValidator : AbstractValidator<GetProfileSummariesQuery>
{
    public const int MaxIds = 50;

    public GetProfileSummariesQueryValidator()
    {
        RuleFor(x => x.UserIds).NotEmpty();
        RuleFor(x => x.UserIds.Count).LessThanOrEqualTo(MaxIds).When(x => x.UserIds is not null);
    }
}
