using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Domain.Entities;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Queries.GetOffers;

public class GetOffersQueryHandler(BankingOptions options) : IRequestHandler<GetOffersQuery, IReadOnlyList<LoanOfferDto>>
{
    public Task<IReadOnlyList<LoanOfferDto>> Handle(GetOffersQuery request, CancellationToken token)
    {
        IReadOnlyList<LoanOfferDto> offers = options.Offers
            .Select(o => new LoanOfferDto(o.Name, o.Principal, o.InterestRate,
                Loan.ComputeTotalDue(o.Principal, o.InterestRate), o.Term, o.RequiredTurnover))
            .ToList();
        return Task.FromResult(offers);
    }
}
