using AuctionServer.Api.Infrastructure.Push;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Banking;
using AuctionServer.Shared.Integration.Events.Casino;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using AuctionServer.Shared.Integration.Events.Players;
using AuctionServer.Shared.Integration.Events.Users;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Api.Tests.Push;

public class PushRoutesTests
{
    private static readonly Guid Seller = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Winner = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Stranger = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid AuctionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid WarehouseId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly PushRoutes Routes = PushRoutes.Build();

    private sealed class Stage : IDisposable
    {
        private readonly PushConnections _connections = new(PushOptions.Default);
        public IPushSubscription SellerStream { get; }
        public IPushSubscription WinnerStream { get; }
        public IPushSubscription StrangerStream { get; }

        public Stage()
        {
            SellerStream = _connections.Subscribe(Seller);
            WinnerStream = _connections.Subscribe(Winner);
            StrangerStream = _connections.Subscribe(Stranger);
        }

        public bool Dispatch(INotification @event) => Routes.Dispatch(@event, _connections);

        public static List<PushMessage> Drain(IPushSubscription subscription)
        {
            var messages = new List<PushMessage>();
            while (subscription.Reader.TryRead(out var message)) messages.Add(message);
            return messages;
        }

        public void Dispose()
        {
            SellerStream.Dispose();
            WinnerStream.Dispose();
            StrangerStream.Dispose();
        }
    }

    private static readonly string AuctionData = $"{{\"auctionId\":\"{AuctionId}\"}}";
    private static readonly string WarehouseData = $"{{\"warehouseId\":\"{WarehouseId}\"}}";

    public static TheoryData<INotification> ListChangingAuctionEvents => new()
    {
        new AuctionActivatedEvent(Guid.NewGuid(), AuctionId, Seller, Guid.NewGuid(), "Sword", "Rare", 100m, 10m, DateTime.UtcNow.AddHours(1)),
        new AuctionFinishedEvent(Guid.NewGuid(), AuctionId, Seller, Winner, 50m)
    };

    [Theory]
    [MemberData(nameof(ListChangingAuctionEvents))]
    public void ActivatedAndFinished_ShouldBroadcastAuctionChangedAndAuctionListChanged(INotification @event)
    {
        using var stage = new Stage();

        Assert.True(stage.Dispatch(@event));

        foreach (var stream in new[] { stage.SellerStream, stage.WinnerStream, stage.StrangerStream })
        {
            var messages = Stage.Drain(stream);
            Assert.Equal(new[] { PushTopics.AuctionChanged, PushTopics.AuctionListChanged }, messages.Select(m => m.Topic).ToList());
            Assert.Equal(AuctionData, messages[0].Data);
            Assert.Equal("{}", messages[1].Data);
        }
    }

    public static TheoryData<INotification> DetailOnlyAuctionEvents => new()
    {
        new BidPlacedEvent(Guid.NewGuid(), AuctionId, Winner, null, 20m, null),
        new AuctionCancelledEvent(Guid.NewGuid(), AuctionId, Guid.NewGuid(), "Item lock rejected")
    };

    [Theory]
    [MemberData(nameof(DetailOnlyAuctionEvents))]
    public void BidPlacedAndCancelled_ShouldBroadcastAuctionChangedOnly(INotification @event)
    {
        using var stage = new Stage();

        Assert.True(stage.Dispatch(@event));

        foreach (var stream in new[] { stage.SellerStream, stage.WinnerStream, stage.StrangerStream })
        {
            var message = Assert.Single(Stage.Drain(stream));
            Assert.Equal(PushTopics.AuctionChanged, message.Topic);
            Assert.Equal(AuctionData, message.Data);
        }
    }

    [Fact]
    public void AuctionSettled_ShouldNudgeTheWalletsOfSellerAndWinnerOnly()
    {
        using var stage = new Stage();

        Assert.True(stage.Dispatch(new AuctionSettledEvent(Guid.NewGuid(), AuctionId, Seller, Winner, 50m)));

        Assert.Equal(PushTopics.WalletChanged, Assert.Single(Stage.Drain(stage.SellerStream)).Topic);
        Assert.Equal(PushTopics.WalletChanged, Assert.Single(Stage.Drain(stage.WinnerStream)).Topic);
        Assert.Empty(Stage.Drain(stage.StrangerStream));
    }

    public static TheoryData<INotification, string> UserEvents => new()
    {
        { new FundsLockedEvent(Guid.NewGuid(), AuctionId, Winner, 20m), PushTopics.WalletChanged },
        { new WarehouseEntryLockedEvent(Guid.NewGuid(), WarehouseId, Winner), PushTopics.WalletChanged },
        { new WarehouseSettledEvent(Guid.NewGuid(), WarehouseId, Winner, []), PushTopics.WalletChanged },
        { new LoanApprovedEvent(Guid.NewGuid(), Guid.NewGuid(), Winner), PushTopics.WalletChanged },
        { new LoanRepaymentCollectedEvent(Guid.NewGuid(), Guid.NewGuid(), Winner, 10m), PushTopics.WalletChanged },
        { new LoanRepaymentRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Winner, 10m), PushTopics.LoanChanged },
        { new CasinoChipPurchaseCompletedEvent(Guid.NewGuid(), Guid.NewGuid(), Winner), PushTopics.WalletChanged },
        { new CasinoCashOutEvent(Guid.NewGuid(), Winner, 10m), PushTopics.CasinoChanged },
        { new PawnshopPaymentCompletedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Winner), PushTopics.WalletChanged },
        { new PawnshopPayoutEvent(Guid.NewGuid(), Guid.NewGuid(), Winner, 10m), PushTopics.PawnshopChanged },
        { new PawnshopItemWithdrawnEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Winner, "Sword", "Rare", 10m), PushTopics.PawnshopChanged },
        { new PlayerLevelledUpEvent(Guid.NewGuid(), Winner, 1, 2, 40m), PushTopics.WalletChanged }
    };

    [Theory]
    [MemberData(nameof(UserEvents))]
    public void UserEvents_ShouldNudgeOnlyTheNamedUser(INotification @event, string topic)
    {
        using var stage = new Stage();

        Assert.True(stage.Dispatch(@event));

        var message = Assert.Single(Stage.Drain(stage.WinnerStream));
        Assert.Equal(topic, message.Topic);
        Assert.Equal("{}", message.Data);
        Assert.Empty(Stage.Drain(stage.SellerStream));
        Assert.Empty(Stage.Drain(stage.StrangerStream));
    }

    [Fact]
    public void WarehouseWon_ShouldBroadcastWarehouseChangedWithTheId()
    {
        using var stage = new Stage();

        Assert.True(stage.Dispatch(new WarehouseWonEvent(Guid.NewGuid(), WarehouseId, Winner, 500m, [])));

        foreach (var stream in new[] { stage.SellerStream, stage.WinnerStream, stage.StrangerStream })
        {
            var message = Assert.Single(Stage.Drain(stream));
            Assert.Equal(PushTopics.WarehouseChanged, message.Topic);
            Assert.Equal(WarehouseData, message.Data);
        }
    }

    public static TheoryData<INotification> SilentEvents => new()
    {
        new FundsLockRejectedEvent(Guid.NewGuid(), AuctionId, Winner, "Insufficient funds"),
        new WarehouseEntryLockRejectedEvent(Guid.NewGuid(), WarehouseId, Winner, "Insufficient funds"),
        new LoanRejectedEvent(Guid.NewGuid(), Guid.NewGuid(), Winner, "Turnover too low"),
        new CasinoChipPurchaseRejectedEvent(Guid.NewGuid(), Guid.NewGuid(), Winner, "Insufficient funds"),
        new PawnshopPaymentRejectedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Winner, "Insufficient funds"),
        new UserRegisteredEvent(Guid.NewGuid(), Winner, "winner@test.local", "winner"),
        new FundsLockRequestedEvent(Guid.NewGuid(), AuctionId, Winner, 20m)
    };

    [Theory]
    [MemberData(nameof(SilentEvents))]
    public void RejectionsRequestsAndRegistration_ShouldSendNothing(INotification @event)
    {
        using var stage = new Stage();

        Assert.False(stage.Dispatch(@event));

        Assert.Empty(Stage.Drain(stage.SellerStream));
        Assert.Empty(Stage.Drain(stage.WinnerStream));
        Assert.Empty(Stage.Drain(stage.StrangerStream));
    }

    [Fact]
    public void Build_ShouldRouteEighteenEventTypes()
    {
        Assert.Equal(18, Routes.Count);
    }
}
