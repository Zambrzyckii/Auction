using System.Text.Json;
using AuctionServer.Modules.Banking.Application.Command.RepayLoan;
using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Outbox;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[Collection(BankingIntegrationCollection.Name)]
public class RepayLoanCommandTests(BankingPostgresFixture fixture)
{
    private async Task HandleAsync(RepayLoanCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new RepayLoanCommandHandler(new BankingRepository(context));
        await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ActiveLoan_ShouldRequestCollectionAndEmitEvent()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);

        await HandleAsync(new RepayLoanCommand(seeded.UserId, seeded.PublicLoanId));

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.CollectionPending, loan.Status);
        Assert.NotNull(loan.LastCollectionRequestedOn);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanRepaymentRequestedEvent)
                              && m.Content.Contains(seeded.PublicLoanId.ToString()));
        var requested = JsonSerializer.Deserialize<LoanRepaymentRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(requested);
        Assert.Equal(outboxMessage.Id, requested.EventId);
        Assert.Equal(220m, requested.Amount);
    }

    [Fact]
    public async Task Handle_ForeignLoan_ShouldThrowNotFoundWithoutStateChange()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);
        var command = new RepayLoanCommand(Guid.NewGuid(), seeded.PublicLoanId);

        await Assert.ThrowsAsync<BankingExceptions.LoanNotFoundException>(() => HandleAsync(command));

        var loan = await fixture.GetLoanAsync(seeded.PublicLoanId);
        Assert.Equal(LoanStatus.Active, loan.Status);
    }

    [Fact]
    public async Task Handle_WhenCollectionAlreadyPending_ShouldThrowCollectionInProgress()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);
        await fixture.RequestCollectionAsync(seeded.PublicLoanId, DateTime.UtcNow);

        await Assert.ThrowsAsync<BankingExceptions.LoanCollectionInProgressException>(
            () => HandleAsync(new RepayLoanCommand(seeded.UserId, seeded.PublicLoanId)));
    }

    [Fact]
    public async Task Handle_MissingLoan_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<BankingExceptions.LoanNotFoundException>(
            () => HandleAsync(new RepayLoanCommand(Guid.NewGuid(), Guid.NewGuid())));
    }

    [Fact]
    public async Task RequestCollection_WhenTwoWritersRace_ShouldEmitExactlyOneRequest()
    {
        var seeded = await fixture.SeedLoanAsync(LoanStatus.Active);
        var now = DateTime.UtcNow;

        await using var context1 = fixture.CreateContext();
        await using var context2 = fixture.CreateContext();
        var repository1 = new BankingRepository(context1);
        var repository2 = new BankingRepository(context2);
        var loan1 = await repository1.GetLoanByPublicIdAsync(seeded.PublicLoanId, CancellationToken.None);
        var loan2 = await repository2.GetLoanByPublicIdAsync(seeded.PublicLoanId, CancellationToken.None);

        var outstanding1 = loan1.RequestCollection(now);
        var outstanding2 = loan2.RequestCollection(now);
        await repository1.SaveLoanWithOutboxAsync(BuildRequest(loan1, outstanding1), CancellationToken.None);

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
            () => repository2.SaveLoanWithOutboxAsync(BuildRequest(loan2, outstanding2), CancellationToken.None));

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(
            m => m.Type == nameof(LoanRepaymentRequestedEvent)
                 && m.Content.Contains(seeded.PublicLoanId.ToString())));
    }

    private static OutboxMessage BuildRequest(Loan loan, decimal outstanding)
    {
        var eventId = Guid.NewGuid();
        return new OutboxMessage
        {
            Id = eventId,
            Type = nameof(LoanRepaymentRequestedEvent),
            Content = JsonSerializer.Serialize(new LoanRepaymentRequestedEvent(
                eventId, loan.PublicLoanId, loan.UserId, outstanding))
        };
    }
}
