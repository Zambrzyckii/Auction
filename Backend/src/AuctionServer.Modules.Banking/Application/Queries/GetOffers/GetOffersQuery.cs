using MediatR;

namespace AuctionServer.Modules.Banking.Application.Queries.GetOffers;

public record GetOffersQuery : IRequest<IReadOnlyList<LoanOfferDto>>;

public record LoanOfferDto(string Name, decimal Principal, decimal InterestRate, decimal TotalDue, TimeSpan Term, decimal RequiredTurnover);
