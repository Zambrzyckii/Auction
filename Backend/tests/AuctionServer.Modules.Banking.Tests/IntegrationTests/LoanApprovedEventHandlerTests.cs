using AuctionServer.Modules.Banking.Application.Handlers;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[Collection(BankingIntegrationCollection.Name)]
public class LoanApprovedEventHandlerTests(BankingPostgresFixture fixture)
{
    private async Task HandleAsync(LoanApprovedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new LoanApprovedEventHandler(new BankingRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldActivateLoanAndStoreInboxRow()
    {
        var seeded = await fixture.SeedLoanAsync();
        var notification = new LoanApprovedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId);

        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Active, loan.Status);
        Assert.NotNull(loan.DueOn);
        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldActivateOnce()
    {
        var seeded = await fixture.SeedLoanAsync();
        var notification = new LoanApprovedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId);

        await HandleAsync(notification);
        var dueOnAfterFirst = (await fixture.GetLoanAsync(seeded.PublicLoanId)).DueOn;
        await HandleAsync(notification);

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Active, loan.Status);
        Assert.Equal(dueOnAfterFirst, loan.DueOn);
    }

    [Fact]
    public async Task Handle_WhenLoanIsRejected_ShouldThrowWithoutInboxRow()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Rejected);
        var notification = new LoanApprovedEvent(Guid.NewGuid(), seeded.PublicLoanId, seeded.UserId);

        await Assert.ThrowsAsync<BankingExceptions.InvalidLoanStateTransitionException>(() => HandleAsync(notification));

        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}
