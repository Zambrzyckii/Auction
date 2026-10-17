using System.Text.Json;
using AuctionServer.Modules.Casino.Application.Command.PurchaseChips;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class PurchaseChipsCommandTests(CasinoPostgresFixture fixture)
{
    private async Task<Guid> HandleAsync(PurchaseChipsCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new PurchaseChipsCommandHandler(new CasinoRepository(context));
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldOpenAccountPersistPendingPurchaseAndEmitRequest()
    {
        var userId = Guid.NewGuid();

        var publicPurchaseId = await HandleAsync(new PurchaseChipsCommand(userId, 500m));

        var purchase = await fixture.GetPurchaseAsync(publicPurchaseId);
        Assert.Equal(ChipPurchaseStatus.Pending, purchase.Status);
        var account = await fixture.GetAccountAsync(userId);
        Assert.Equal(0m, account.Balance);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(CasinoChipPurchaseRequestedEvent)
                              && m.Content.Contains(publicPurchaseId.ToString()));
        var requested = JsonSerializer.Deserialize<CasinoChipPurchaseRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(requested);
        Assert.Equal(outboxMessage.Id, requested.EventId);
        Assert.Equal(500m, requested.Amount);
    }

    [Fact]
    public async Task Handle_WhenPurchaseInFlight_ShouldThrowPurchaseInProgress()
    {
        var account = await fixture.SeedAccountAsync();
        await fixture.SeedPurchaseAsync(account.UserId);

        await Assert.ThrowsAsync<CasinoExceptions.PurchaseInProgressException>(
            () => HandleAsync(new PurchaseChipsCommand(account.UserId, 100m)));
    }

    [Fact]
    public async Task Handle_AfterResolvedPurchase_ShouldAllowNextPurchase()
    {
        var account = await fixture.SeedAccountAsync();
        await fixture.SeedPurchaseAsync(account.UserId, status: ChipPurchaseStatus.Rejected);

        var publicPurchaseId = await HandleAsync(new PurchaseChipsCommand(account.UserId, 200m));

        var purchase = await fixture.GetPurchaseAsync(publicPurchaseId);
        Assert.Equal(ChipPurchaseStatus.Pending, purchase.Status);
    }
}
