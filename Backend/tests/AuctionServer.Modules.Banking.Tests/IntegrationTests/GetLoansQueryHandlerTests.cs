using AuctionServer.Modules.Banking.Application.Queries.GetLoans;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[Collection(BankingIntegrationCollection.Name)]
public class GetLoansQueryHandlerTests(BankingPostgresFixture fixture)
{
    [Fact]
    public async Task Handle_ShouldReturnOnlyCallersLoansNewestFirst()
    {
        var userId = Guid.NewGuid();
        var rejected = await fixture.SeedLoanAsync(LoanStatus.Rejected, userId);
        var pending = await fixture.SeedLoanAsync(userId: userId);
        await fixture.SeedLoanAsync();

        await using var context = fixture.CreateContext();
        var handler = new GetLoansQueryHandler(new BankingRepository(context));
        var loans = await handler.Handle(new GetLoansQuery(userId), CancellationToken.None);

        Assert.Equal(2, loans.Count);
        Assert.Equal(pending.PublicLoanId, loans[0].PublicLoanId);
        Assert.Equal(rejected.PublicLoanId, loans[1].PublicLoanId);
        var dto = loans[0];
        Assert.Equal(LoanStatus.PendingApproval, dto.Status);
        Assert.Equal(220m, dto.TotalDue);
        Assert.Equal(220m, dto.Outstanding);
    }
}
