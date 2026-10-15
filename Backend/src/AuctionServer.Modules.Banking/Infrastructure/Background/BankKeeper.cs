using System.Text.Json;
using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Modules.Banking.Infrastructure.Outbox;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AuctionServer.Modules.Banking.Infrastructure.Background;

public sealed class BankKeeper(IServiceProvider serviceProvider, ILogger<BankKeeper> logger, BankingOptions options)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCycleAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Bank keeper cycle failed");
            }

            await Task.Delay(5000, stoppingToken);
        }
    }

    private async Task RunCycleAsync(CancellationToken token)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<BankingDbContext>();
        await RejectStaleApprovalsAsync(context, token);
        await CollectMaturedLoansAsync(context, token);
    }
    
    private async Task RejectStaleApprovalsAsync(BankingDbContext context, CancellationToken token)
    {
        var cutoff = DateTime.UtcNow - options.ApprovalTimeout;
        var staleLoans = await context.Loans
            .Where(l => l.Status == LoanStatus.PendingApproval && l.RequestedOn <= cutoff)
            .Take(50)
            .ToListAsync(token);
        if (staleLoans.Count == 0) return;

        foreach (var loan in staleLoans)
        {
            logger.LogWarning("Rejecting loan {PublicLoanId} because its approval timed out", loan.PublicLoanId);
            loan.Reject("Approval timed out");
        }

        await context.SaveChangesAsync(token);
    }

    private async Task CollectMaturedLoansAsync(BankingDbContext context, CancellationToken token)
    {
        var now = DateTime.UtcNow;
        var maturedLoans = await context.Loans
            .Where(l => l.Status == LoanStatus.Active && l.DueOn <= now)
            .Take(50)
            .ToListAsync(token);
        if (maturedLoans.Count == 0) return;

        foreach (var loan in maturedLoans)
        {
            var outstanding = loan.RequestCollection(now);
            var eventId = Guid.NewGuid();
            context.OutboxMessages.Add(new OutboxMessage
            {
                Id = eventId,
                Type = nameof(LoanRepaymentRequestedEvent),
                Content = JsonSerializer.Serialize(new LoanRepaymentRequestedEvent(
                    eventId, loan.PublicLoanId, loan.UserId, outstanding))
            });
        }

        await context.SaveChangesAsync(token);
    }
}
