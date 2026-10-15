using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Domain.Exceptions;

namespace AuctionServer.Modules.Banking.Tests.Domain.Entities;

public class LoanCollectionTests
{
    private static readonly DateTime ApprovedOn = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);

    private static Loan CreateActiveLoan(decimal principal = 200m, decimal interestRate = 0.10m,
        decimal penaltyRate = 0.20m, TimeSpan? term = null)
    {
        var loan = Loan.Create(Guid.NewGuid(), "Quick", principal, interestRate, penaltyRate, 400m,
            term ?? TimeSpan.FromMinutes(1));
        loan.Approve(ApprovedOn);
        return loan;
    }

    private static DateTime BeforeDue => ApprovedOn + TimeSpan.FromSeconds(30);
    private static DateTime AtDue => ApprovedOn + TimeSpan.FromMinutes(1);
    private static DateTime AfterDue => ApprovedOn + TimeSpan.FromMinutes(2);

    [Fact]
    public void RequestCollection_FromActive_ShouldMoveToCollectionPendingAndReturnOutstanding()
    {
        var loan = CreateActiveLoan();
        var versionBefore = loan.Version;

        var outstanding = loan.RequestCollection(AtDue);

        Assert.Equal(220m, outstanding);
        Assert.Equal(LoanStatus.CollectionPending, loan.Status);
        Assert.Equal(AtDue, loan.LastCollectionRequestedOn);
        Assert.NotEqual(versionBefore, loan.Version);
    }

    [Fact]
    public void RequestCollection_WhenCollectionPending_ShouldThrowCollectionInProgress()
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AtDue);

        Assert.Throws<BankingExceptions.LoanCollectionInProgressException>(() => loan.RequestCollection(AtDue));
    }

    [Fact]
    public void RequestCollection_WhenRepaid_ShouldThrowAlreadyRepaid()
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AtDue);
        loan.ApplyCollection(220m, AtDue);

        Assert.Throws<BankingExceptions.LoanAlreadyRepaidException>(() => loan.RequestCollection(AfterDue));
    }

    [Fact]
    public void RequestCollection_WhenPendingApproval_ShouldThrowInvalidTransition()
    {
        var loan = Loan.Create(Guid.NewGuid(), "Quick", 200m, 0.10m, 0.20m, 400m, TimeSpan.FromMinutes(1));

        Assert.Throws<BankingExceptions.InvalidLoanStateTransitionException>(() => loan.RequestCollection(AtDue));
    }

    [Fact]
    public void ApplyCollection_FullCoverage_ShouldRepay()
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AtDue);

        loan.ApplyCollection(220m, AtDue);

        Assert.Equal(LoanStatus.Repaid, loan.Status);
        Assert.Equal(AtDue, loan.RepaidOn);
        Assert.Equal(220m, loan.AmountRepaid);
        Assert.Equal(0m, loan.Outstanding);
        Assert.Equal(0m, loan.Penalty);
    }

    [Fact]
    public void ApplyCollection_PartialBeforeDue_ShouldReturnToActiveWithoutPenalty()
    {
        var loan = CreateActiveLoan(term: TimeSpan.FromMinutes(10));
        loan.RequestCollection(BeforeDue);

        loan.ApplyCollection(100m, BeforeDue);

        Assert.Equal(LoanStatus.Active, loan.Status);
        Assert.Equal(0m, loan.Penalty);
        Assert.Null(loan.OverdueSince);
        Assert.Equal(120m, loan.Outstanding);
    }

    [Fact]
    public void ApplyCollection_PartialAtDue_ShouldGoOverdueWithOneTimePenalty()
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AtDue);

        loan.ApplyCollection(100m, AtDue);

        Assert.Equal(LoanStatus.Overdue, loan.Status);
        Assert.Equal(24.00m, loan.Penalty);
        Assert.Equal(AtDue, loan.OverdueSince);
        Assert.Equal(144m, loan.Outstanding);
    }

    [Fact]
    public void ApplyCollection_SecondLateCollection_ShouldNotChargePenaltyAgain()
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AtDue);
        loan.ApplyCollection(100m, AtDue);

        var outstanding = loan.RequestCollection(AfterDue);
        loan.ApplyCollection(44m, AfterDue);

        Assert.Equal(144m, outstanding);
        Assert.Equal(LoanStatus.Overdue, loan.Status);
        Assert.Equal(24.00m, loan.Penalty);
        Assert.Equal(AtDue, loan.OverdueSince);
        Assert.Equal(100m, loan.Outstanding);
    }

    [Fact]
    public void ApplyCollection_ZeroCollectedAfterDue_ShouldChargePenaltyOnFullRemainder()
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AfterDue);

        loan.ApplyCollection(0m, AfterDue);

        Assert.Equal(LoanStatus.Overdue, loan.Status);
        Assert.Equal(44.00m, loan.Penalty);
        Assert.Equal(264m, loan.Outstanding);
    }

    [Fact]
    public void ApplyCollection_WhenPenaltyRoundsToZero_ShouldStillMarkOverdueOnce()
    {
        var loan = CreateActiveLoan(principal: 0.25m);
        loan.RequestCollection(AtDue);
        loan.ApplyCollection(0.27m, AtDue);

        Assert.Equal(LoanStatus.Overdue, loan.Status);
        Assert.Equal(0.00m, loan.Penalty);
        Assert.Equal(AtDue, loan.OverdueSince);

        loan.RequestCollection(AfterDue);
        loan.ApplyCollection(0m, AfterDue);

        Assert.Equal(0.00m, loan.Penalty);
        Assert.Equal(AtDue, loan.OverdueSince);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(221)]
    public void ApplyCollection_WithAmountOutsideOutstanding_ShouldThrowInvalidAmount(decimal collected)
    {
        var loan = CreateActiveLoan();
        loan.RequestCollection(AtDue);

        Assert.Throws<BankingExceptions.InvalidCollectionAmountException>(() => loan.ApplyCollection(collected, AtDue));
    }

    [Fact]
    public void ApplyCollection_WhenNotCollectionPending_ShouldThrowInvalidTransition()
    {
        var loan = CreateActiveLoan();

        Assert.Throws<BankingExceptions.InvalidLoanStateTransitionException>(() => loan.ApplyCollection(100m, AtDue));
    }
}
