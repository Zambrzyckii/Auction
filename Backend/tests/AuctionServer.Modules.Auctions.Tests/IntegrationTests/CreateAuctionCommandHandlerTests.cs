using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Commands.CreateAuction;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class CreateAuctionCommandHandlerTests(AuctionsPostgresFixture fixture)
{
    private static CreateAuctionCommand CreateCommand(Guid? itemId = null) =>
        new(Guid.NewGuid(), itemId ?? Guid.NewGuid(), 10m, DateTimeOffset.UtcNow.AddMinutes(10));

    private async Task<Guid> HandleAsync(CreateAuctionCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new CreateAuctionCommandHandler(new AuctionRepository(context));
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldCreatePendingAuctionAndStoreItemLockRequestedEvent()
    {
        var command = CreateCommand();

        var id = await HandleAsync(command);

        var auction = await fixture.GetAuctionAsync(id);
        Assert.Equal(AuctionStatus.Pending, auction.Status);
        Assert.Equal(command.SellerId, auction.SellerUserId);
        Assert.Equal(command.ItemId, auction.ItemId);
        Assert.Equal(10m, auction.CurrentPrice);
        Assert.Null(auction.ItemName);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(ItemLockRequestedEvent) && m.Content.Contains(id.ToString()));
        var lockRequested = JsonSerializer.Deserialize<ItemLockRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(lockRequested);
        Assert.Equal(outboxMessage.Id, lockRequested.EventId);
        Assert.Equal(id, lockRequested.PublicAuctionId);
        Assert.Equal(command.ItemId, lockRequested.PublicItemId);
        Assert.Equal(command.SellerId, lockRequested.SellerUserId);
    }

    [Fact]
    public async Task Handle_WhenItemAlreadyHasOpenAuction_ShouldThrowAndPersistNothing()
    {
        var itemId = Guid.NewGuid();
        await HandleAsync(CreateCommand(itemId));

        await Assert.ThrowsAsync<AuctionExceptions.AuctionAlreadyExistException>(() => HandleAsync(CreateCommand(itemId)));

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.Auctions.CountAsync(a => a.ItemId == itemId));
        Assert.Equal(1, await context.OutboxMessages.CountAsync(m => m.Content.Contains(itemId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenPreviousAuctionForItemIsCancelled_ShouldCreateNewAuction()
    {
        var itemId = Guid.NewGuid();
        var cancelled = await fixture.SeedAuctionAsync(itemId: itemId);
        await fixture.CancelAuctionAsync(cancelled.PublicAuctionId, "rejected");

        var id = await HandleAsync(CreateCommand(itemId));

        var auction = await fixture.GetAuctionAsync(id);
        Assert.Equal(AuctionStatus.Pending, auction.Status);
    }
}