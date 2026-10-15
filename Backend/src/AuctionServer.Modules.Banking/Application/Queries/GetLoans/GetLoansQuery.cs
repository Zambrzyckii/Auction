using AuctionServer.Modules.Banking.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Queries.GetLoans;

public record GetLoansQuery(Guid UserId) : IRequest<IReadOnlyList<LoanDto>>;

public record LoanDto(
    Guid PublicLoanId,
    string OfferName,
    decimal Principal,
    decimal InterestRate,
    decimal TotalDue,
    decimal Penalty,
    decimal AmountRepaid,
    decimal Outstanding,
    LoanStatus Status,
    DateTime RequestedOn,
    DateTime? DueOn,
    DateTime? OverdueSince,
    DateTime? RepaidOn,
    string? RejectionReason);
