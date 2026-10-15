using System.Text.Json;
using AuctionServer.Modules.Banking.Application.Command.CreateLoan;
using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[Collection(BankingIntegrationCollection.Name)]
public class CreateLoanCommandTests(BankingPostgresFixture fixture)
{
    private static readonly BankingOptions Options = new(0.20m, TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(15), [new LoanOfferDefinition("Quick", 200m, 0.10m, TimeSpan.FromMinutes(1), 400m)]);

    private async Task<Guid> HandleAsync(CreateLoanCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new CreateLoanCommandHandler(new BankingRepository(context), Options);
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldStorePendingLoanAndOutboxRowWithMatchingIds()
    {
        var userId = Guid.NewGuid();

        var publicLoanId = await HandleAsync(new CreateLoanCommand(userId, "Quick"));

        var loan = await fixture.GetLoanAsync(publicLoanId);
        Assert.Equal(LoanStatus.PendingApproval, loan.Status);
        Assert.Equal(userId, loan.UserId);
        Assert.Equal(200m, loan.Principal);
        Assert.Equal(220m, loan.TotalDue);
        Assert.Null(loan.DueOn);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanRequestedEvent) && m.Content.Contains(publicLoanId.ToString()));
        var requested = JsonSerializer.Deserialize<LoanRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(requested);
        Assert.Equal(outboxMessage.Id, requested.EventId);
        Assert.Equal(400m, requested.RequiredTurnover);
        Assert.Equal(200m, requested.Principal);
    }

    [Fact]
    public async Task Handle_WithUnknownOffer_ShouldThrowNotFoundWithoutRows()
    {
        var userId = Guid.NewGuid();

        await Assert.ThrowsAsync<BankingExceptions.LoanOfferNotFoundException>(
            () => HandleAsync(new CreateLoanCommand(userId, "Luxury")));

        await using var context = fixture.CreateContext();
        Assert.False(await context.Loans.AnyAsync(l => l.UserId == userId));
    }

    [Theory]
    [InlineData(LoanStatus.PendingApproval)]
    [InlineData(LoanStatus.Active)]
    public async Task Handle_WhenOpenLoanExists_ShouldThrowConflict(LoanStatus existingStatus)
    {
        var userId = Guid.NewGuid();
        await fixture.SeedLoanAsync(existingStatus, userId);

        await Assert.ThrowsAsync<BankingExceptions.LoanAlreadyActiveException>(
            () => HandleAsync(new CreateLoanCommand(userId, "Quick")));

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.Loans.CountAsync(l => l.UserId == userId));
    }

    [Fact]
    public async Task Handle_AfterRejectedLoan_ShouldSucceed()
    {
        var userId = Guid.NewGuid();
        await fixture.SeedLoanAsync(LoanStatus.Rejected, userId);

        var publicLoanId = await HandleAsync(new CreateLoanCommand(userId, "Quick"));

        var loan = await fixture.GetLoanAsync(publicLoanId);
        Assert.Equal(LoanStatus.PendingApproval, loan.Status);
    }
}
