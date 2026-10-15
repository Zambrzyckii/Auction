using AuctionServer.Modules.Wallets.Application.Command.TransferFunds;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class TransferFundsCommandHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(TransferFundsCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new TransferFundsCommandHandler(new WalletRepository(context));
        await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenTransferIsValid_ShouldMoveFundsAndAppendHistoryRow()
    {
        var senderId = await fixture.SeedWalletAsync(300m);
        var recipientId = await fixture.SeedWalletAsync(0m);

        await HandleAsync(new TransferFundsCommand(senderId, recipientId, 120m));

        var sender = await fixture.GetWalletAsync(senderId);
        var recipient = await fixture.GetWalletAsync(recipientId);
        Assert.Equal(180m, sender.AvailableFunds);
        Assert.Equal(120m, recipient.AvailableFunds);
        Assert.Equal(300m, sender.LifetimeTurnover);
        Assert.Equal(0m, recipient.LifetimeTurnover);

        await using var context = fixture.CreateContext();
        var transfer = await context.Transfers.SingleAsync(t => t.SenderUserId == senderId);
        Assert.Equal(recipientId, transfer.RecipientUserId);
        Assert.Equal(120m, transfer.Amount);
    }

    [Fact]
    public async Task Handle_WhenRecipientHasNoWallet_ShouldThrowAndChangeNothing()
    {
        var senderId = await fixture.SeedWalletAsync(300m);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => HandleAsync(new TransferFundsCommand(senderId, Guid.NewGuid(), 120m)));

        var sender = await fixture.GetWalletAsync(senderId);
        Assert.Equal(300m, sender.AvailableFunds);
        await using var context = fixture.CreateContext();
        Assert.False(await context.Transfers.AnyAsync(t => t.SenderUserId == senderId));
    }

    [Fact]
    public async Task Handle_WhenSenderHasInsufficientFunds_ShouldThrowAndChangeNothing()
    {
        var senderId = await fixture.SeedWalletAsync(50m);
        var recipientId = await fixture.SeedWalletAsync(0m);

        await Assert.ThrowsAsync<WalletExceptions.InsufficientFundsException>(
            () => HandleAsync(new TransferFundsCommand(senderId, recipientId, 100m)));

        Assert.Equal(50m, (await fixture.GetWalletAsync(senderId)).AvailableFunds);
        Assert.Equal(0m, (await fixture.GetWalletAsync(recipientId)).AvailableFunds);
        await using var context = fixture.CreateContext();
        Assert.False(await context.Transfers.AnyAsync(t => t.SenderUserId == senderId));
    }
}
