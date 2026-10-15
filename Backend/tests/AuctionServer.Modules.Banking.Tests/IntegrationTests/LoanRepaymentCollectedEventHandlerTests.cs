using AuctionServer.Modules.Banking.Application.Handlers;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[Collection(BankingIntegrationCollection.Name)]
public class LoanRepaymentCollectedEventHandlerTests(BankingPostgresFixture fixture)
{
    private async Task HandleAsync(LoanRepaymentCollectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new LoanRepaymentCollectedEventHandler(new BankingRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenFullAmountCollected_ShouldRepayLoan()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);
        await fixture.RequestCollectionAsync(seeded.PublicLoanId, DateTime.UtcNow);
        var notification = new LoanRepaymentCollectedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId, 220m);

        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Repaid, loan.Status);
        Assert.NotNull(loan.RepaidOn);
        Assert.Equal(0m, loan.Outstanding);
        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenPartialAfterDue_ShouldGoOverdueWithPenalty()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);
        await fixture.RequestCollectionAsync(seeded.PublicLoanId, DateTime.UtcNow.AddMinutes(2));
        var notification = new LoanRepaymentCollectedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId, 100m);

        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Overdue, loan.Status);
        Assert.Equal(24.00m, loan.Penalty);
        Assert.NotNull(loan.OverdueSince);
        Assert.Equal(144m, loan.Outstanding);
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldApplyOnce()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);
        await fixture.RequestCollectionAsync(seeded.PublicLoanId, DateTime.UtcNow);
        var notification = new LoanRepaymentCollectedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId, 100m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Active, loan.Status);
        Assert.Equal(100m, loan.AmountRepaid);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == notification.EventId));
    }
}
