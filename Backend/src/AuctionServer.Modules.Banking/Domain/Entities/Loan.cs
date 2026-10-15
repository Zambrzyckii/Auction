using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Domain.Exceptions;

namespace AuctionServer.Modules.Banking.Domain.Entities;

public sealed class Loan
{
    public int Id { get; init; }
    public Guid PublicLoanId { get; init; } = Guid.NewGuid();
    public Guid UserId { get; init; }
    public required string OfferName { get; init; }
    public decimal Principal { get; init; }
    public decimal InterestRate { get; init; }
    public decimal PenaltyRate { get; init; }
    public decimal RequiredTurnover { get; init; }
    public TimeSpan Term { get; init; }
    public decimal TotalDue { get; private set; }
    public decimal Penalty { get; private set; }
    public decimal AmountRepaid { get; private set; }
    public LoanStatus Status { get; private set; } = LoanStatus.PendingApproval;
    public DateTime RequestedOn { get; init; } = DateTime.UtcNow;
    public DateTime? DueOn { get; private set; }
    public DateTime? LastCollectionRequestedOn { get; private set; }
    public DateTime? OverdueSince { get; private set; }
    public DateTime? RepaidOn { get; private set; }
    public string? RejectionReason { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    public decimal Outstanding => TotalDue + Penalty - AmountRepaid;

    public static Loan Create(Guid userId, string offerName, decimal principal, decimal interestRate,
        decimal penaltyRate, decimal requiredTurnover, TimeSpan term)
    {
        if (principal <= 0 || interestRate <= 0 || penaltyRate < 0 || term <= TimeSpan.Zero)
            throw new BankingExceptions.InvalidLoanTermsException();

        return new Loan
        {
            UserId = userId,
            OfferName = offerName,
            Principal = principal,
            InterestRate = interestRate,
            PenaltyRate = penaltyRate,
            RequiredTurnover = requiredTurnover,
            Term = term,
            TotalDue = ComputeTotalDue(principal, interestRate)
        };
    }

    public static decimal ComputeTotalDue(decimal principal, decimal interestRate)
        => principal + Math.Round(principal * interestRate, 2, MidpointRounding.AwayFromZero);

    public void Approve(DateTime now)
    {
        if (Status != LoanStatus.PendingApproval)
            throw new BankingExceptions.InvalidLoanStateTransitionException(Status, LoanStatus.Active);

        Status = LoanStatus.Active;
        DueOn = now + Term;
        Version = Guid.NewGuid();
    }

    public void Reject(string reason)
    {
        if (Status != LoanStatus.PendingApproval)
            throw new BankingExceptions.InvalidLoanStateTransitionException(Status, LoanStatus.Rejected);

        Status = LoanStatus.Rejected;
        RejectionReason = reason;
        Version = Guid.NewGuid();
    }
}
