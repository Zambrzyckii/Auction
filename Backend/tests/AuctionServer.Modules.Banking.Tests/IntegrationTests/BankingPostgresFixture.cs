using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Banking.Tests.IntegrationTests;

[CollectionDefinition(BankingIntegrationCollection.Name)]
public sealed class BankingIntegrationCollection : ICollectionFixture<BankingPostgresFixture>
{
    public const string Name = "BankingIntegration";
}

public sealed class BankingPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:latest")
        .WithDatabase("banking_integration_tests")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
        await using var context = CreateContext();
        await context.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await _dbContainer.DisposeAsync();

    public BankingDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<BankingDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new BankingDbContext(options);
    }

    public async Task<Loan> SeedLoanAsync(LoanStatus status = LoanStatus.PendingApproval, Guid? userId = null,
        decimal principal = 200m, decimal interestRate = 0.10m, decimal penaltyRate = 0.20m,
        decimal requiredTurnover = 400m, TimeSpan? term = null)
    {
        await using var context = CreateContext();
        var loan = Loan.Create(userId ?? Guid.NewGuid(), "Quick", principal, interestRate, penaltyRate,
            requiredTurnover, term ?? TimeSpan.FromMinutes(1));
        if (status == LoanStatus.Active) loan.Approve(DateTime.UtcNow);
        if (status == LoanStatus.Rejected) loan.Reject("Seeded as rejected");
        context.Loans.Add(loan);
        await context.SaveChangesAsync();
        return loan;
    }

    public async Task<decimal> RequestCollectionAsync(Guid publicLoanId, DateTime requestedOn)
    {
        await using var context = CreateContext();
        var loan = await context.Loans.SingleAsync(l => l.PublicLoanId == publicLoanId);
        var outstanding = loan.RequestCollection(requestedOn);
        await context.SaveChangesAsync();
        return outstanding;
    }

    public async Task<Loan> GetLoanAsync(Guid publicLoanId)
    {
        await using var context = CreateContext();
        return await context.Loans.AsNoTracking().SingleAsync(l => l.PublicLoanId == publicLoanId);
    }
}
