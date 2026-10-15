using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Domain.Exceptions;

namespace AuctionServer.Modules.Banking.Tests.Domain.Entities;

public class LoanTests
{
    private static Loan CreateLoan(decimal principal = 200m, decimal interestRate = 0.10m,
        decimal penaltyRate = 0.20m, TimeSpan? term = null) =>
        Loan.Create(Guid.NewGuid(), "Quick", principal, interestRate, penaltyRate, 400m,
            term ?? TimeSpan.FromMinutes(1));

    [Theory]
    [InlineData(200, 0.10, 220.00)]
    [InlineData(1000, 0.15, 1150.00)]
    [InlineData(333.33, 0.10, 366.66)]
    public void Create_ShouldComputeFlatInterestAndTotalDue(decimal principal, decimal rate, decimal expectedTotalDue)
    {
        var loan = CreateLoan(principal, rate);

        Assert.Equal(expectedTotalDue, loan.TotalDue);
        Assert.Equal(expectedTotalDue, loan.Outstanding);
    }

    [Theory]
    [InlineData(0.25, 0.10, 0.28)]
    [InlineData(0.45, 0.10, 0.50)]
    public void Create_ShouldRoundInterestAwayFromZero(decimal principal, decimal rate, decimal expectedTotalDue)
    {
        var loan = CreateLoan(principal, rate);

        Assert.Equal(expectedTotalDue, loan.TotalDue);
    }

    [Fact]
    public void Create_ShouldStartPendingApprovalWithSnapshotAndNoDueDate()
    {
        var loan = Loan.Create(Guid.NewGuid(), "Quick", 200m, 0.10m, 0.20m, 400m, TimeSpan.FromMinutes(1));

        Assert.Equal(LoanStatus.PendingApproval, loan.Status);
        Assert.Equal("Quick", loan.OfferName);
        Assert.Equal(0.10m, loan.InterestRate);
        Assert.Equal(0.20m, loan.PenaltyRate);
        Assert.Equal(400m, loan.RequiredTurnover);
        Assert.Equal(TimeSpan.FromMinutes(1), loan.Term);
        Assert.Null(loan.DueOn);
        Assert.Null(loan.RejectionReason);
        Assert.Equal(0m, loan.Penalty);
        Assert.Equal(0m, loan.AmountRepaid);
    }

    [Theory]
    [InlineData(0, 0.10, 1)]
    [InlineData(-200, 0.10, 1)]
    [InlineData(200, 0, 1)]
    [InlineData(200, 0.10, 0)]
    public void Create_WithNonPositiveTerms_ShouldThrowInvalidLoanTerms(decimal principal, decimal rate, int minutes)
    {
        Assert.Throws<BankingExceptions.InvalidLoanTermsException>(() =>
            Loan.Create(Guid.NewGuid(), "Quick", principal, rate, 0.20m, 400m, TimeSpan.FromMinutes(minutes)));
    }

    [Fact]
    public void Approve_ShouldActivateAndSetDueOnFromNow()
    {
        var loan = CreateLoan(term: TimeSpan.FromMinutes(10));
        var versionBefore = loan.Version;
        var now = DateTime.UtcNow;

        loan.Approve(now);

        Assert.Equal(LoanStatus.Active, loan.Status);
        Assert.Equal(now + TimeSpan.FromMinutes(10), loan.DueOn);
        Assert.NotEqual(versionBefore, loan.Version);
    }

    [Fact]
    public void Approve_WhenNotPending_ShouldThrowInvalidTransition()
    {
        var loan = CreateLoan();
        loan.Approve(DateTime.UtcNow);

        Assert.Throws<BankingExceptions.InvalidLoanStateTransitionException>(() => loan.Approve(DateTime.UtcNow));
    }

    [Fact]
    public void Reject_ShouldStoreReason()
    {
        var loan = CreateLoan();
        var versionBefore = loan.Version;

        loan.Reject("Lifetime turnover 0 is below the required 400");

        Assert.Equal(LoanStatus.Rejected, loan.Status);
        Assert.Equal("Lifetime turnover 0 is below the required 400", loan.RejectionReason);
        Assert.NotEqual(versionBefore, loan.Version);
    }

    [Fact]
    public void Reject_WhenActive_ShouldThrowInvalidTransition()
    {
        var loan = CreateLoan();
        loan.Approve(DateTime.UtcNow);

        Assert.Throws<BankingExceptions.InvalidLoanStateTransitionException>(() => loan.Reject("Too late"));
    }
}
