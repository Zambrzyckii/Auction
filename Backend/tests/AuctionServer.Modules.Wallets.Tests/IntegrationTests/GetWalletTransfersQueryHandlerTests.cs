using AuctionServer.Modules.Wallets.Application.Command.TransferFunds;
using AuctionServer.Modules.Wallets.Application.Queries.GetWalletTransfers;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class GetWalletTransfersQueryHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task<List<TransferDto>> HandleAsync(GetWalletTransfersQuery query)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetWalletTransfersQueryHandler(new WalletRepository(context));
        return await handler.Handle(query, CancellationToken.None);
    }

    private async Task TransferAsync(Guid senderId, Guid recipientId, decimal amount)
    {
        await using var context = fixture.CreateContext();
        var handler = new TransferFundsCommandHandler(new WalletRepository(context));
        await handler.Handle(new TransferFundsCommand(senderId, recipientId, amount), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenUserSentAndReceived_ShouldReturnBothNewestFirst()
    {
        var userId = await fixture.SeedWalletAsync(200m);
        var otherId = await fixture.SeedWalletAsync(200m);
        await TransferAsync(userId, otherId, 50m);
        await TransferAsync(otherId, userId, 30m);

        var result = await HandleAsync(new GetWalletTransfersQuery(userId));

        Assert.Equal(2, result.Count);
        Assert.Equal(30m, result[0].Amount);
        Assert.Equal(userId, result[0].RecipientUserId);
        Assert.Equal(50m, result[1].Amount);
        Assert.Equal(userId, result[1].SenderUserId);
    }

    [Fact]
    public async Task Handle_WhenUserHasNoTransfers_ShouldReturnEmptyList()
    {
        var userId = await fixture.SeedWalletAsync(100m);

        var result = await HandleAsync(new GetWalletTransfersQuery(userId));

        Assert.Empty(result);
    }

    [Fact]
    public async Task Handle_WhenUserHasNoWallet_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => HandleAsync(new GetWalletTransfersQuery(Guid.NewGuid())));
    }

    [Fact]
    public async Task Handle_WhenOtherUsersTransfer_ShouldNotLeakTheirRows()
    {
        var userId = await fixture.SeedWalletAsync(100m);
        var senderId = await fixture.SeedWalletAsync(100m);
        var recipientId = await fixture.SeedWalletAsync(100m);
        await TransferAsync(senderId, recipientId, 10m);

        var result = await HandleAsync(new GetWalletTransfersQuery(userId));

        Assert.Empty(result);
    }
}
