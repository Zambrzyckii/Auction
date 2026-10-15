using AuctionServer.Modules.Banking.Application.Handlers;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[Collection(BankingIntegrationCollection.Name)]
public class LoanRejectedEventHandlerTests(BankingPostgresFixture fixture)
{
    private async Task HandleAsync(LoanRejectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new LoanRejectedEventHandler(new BankingRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldRejectLoanWithReasonAndFreeTheUserSlot()
    {
        var seeded = await fixture.SeedLoanAsync();
        var notification = new LoanRejectedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId, "Turnover too low");

        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Rejected, loan.Status);
        Assert.Equal("Turnover too low", loan.RejectionReason);

        var retry = await fixture.SeedLoanAsync(userId: seeded.UserId);
        Assert.Equal(LoanStatus.PendingApproval, retry.Status);
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldBeNoOp()
    {
        var seeded = await fixture.SeedLoanAsync();
        var notification = new LoanRejectedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId, "Turnover too low");

        await HandleAsync(notification);
        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Rejected, loan.Status);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == notification.EventId));
    }
}
