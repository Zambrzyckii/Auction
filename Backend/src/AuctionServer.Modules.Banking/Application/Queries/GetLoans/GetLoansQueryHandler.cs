using AuctionServer.Modules.Banking.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Queries.GetLoans;

public class GetLoansQueryHandler(IBankingRepository repository) : IRequestHandler<GetLoansQuery, IReadOnlyList<LoanDto>>
{
    public async Task<IReadOnlyList<LoanDto>> Handle(GetLoansQuery request, CancellationToken token)
    {
        var loans = await repository.GetUserLoansReadOnlyAsync(request.UserId, token);
        return loans.Select(l => new LoanDto(l.PublicLoanId, l.OfferName, l.Principal, l.InterestRate,
            l.TotalDue, l.Penalty, l.AmountRepaid, l.Outstanding, l.Status,
            l.RequestedOn, l.DueOn, l.OverdueSince, l.RepaidOn, l.RejectionReason)).ToList();
    }
}
