using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;

namespace AuctionServer.Modules.Warehouses.Tests.Domain.Entities;

public class WarehouseWarTests
{
    [Fact]
    public void Create_WhenEntryFeeIsPositive_ShouldStartStocking()
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Equal(WarehouseWarStatus.Stocking, war.Status);
        Assert.Equal("Small", war.Tier);
        Assert.Equal(500m, war.EntryFee);
        Assert.NotEqual(Guid.Empty, war.PublicWarehouseId);
        Assert.Null(war.CurrentLeaderId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public void Create_WhenEntryFeeIsNotPositive_ShouldThrowException(decimal entryFee)
    {
        Assert.Throws<WarehouseExceptions.InvalidEntryFeeException>(() => WarehouseWar.Create("Small", entryFee));
    }

    [Fact]
    public void OpenLobby_WhenStocking_ShouldStoreEstimatesAndOpen()
    {
        var war = WarehouseWar.Create("Small", 500m);
        var versionBeforeOpen = war.Version;

        war.OpenLobby(totalValue: 350m, estimateMin: 200m, estimateMax: 600m);

        Assert.Equal(WarehouseWarStatus.Open, war.Status);
        Assert.Equal(350m, war.TotalValue);
        Assert.Equal(200m, war.EstimateMin);
        Assert.Equal(600m, war.EstimateMax);
        Assert.NotEqual(versionBeforeOpen, war.Version);
    }

    [Fact]
    public void OpenLobby_WhenAlreadyOpen_ShouldThrowException()
    {
        var war = WarehouseWar.Create("Small", 500m);
        war.OpenLobby(350m, 200m, 600m);

        Assert.Throws<WarehouseExceptions.WarNotStockingException>(() => war.OpenLobby(350m, 200m, 600m));
    }

    [Theory]
    [InlineData(0, 200, 600)]
    [InlineData(350, 0, 600)]
    [InlineData(350, 700, 600)]
    public void OpenLobby_WhenValuesAreInvalid_ShouldThrowException(decimal totalValue, decimal min, decimal max)
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Throws<WarehouseExceptions.InvalidEstimateException>(() => war.OpenLobby(totalValue, min, max));
        Assert.Equal(WarehouseWarStatus.Stocking, war.Status);
    }

    private static WarehouseWar CreateOpenWar()
    {
        var war = WarehouseWar.Create("Small", 500m);
        war.OpenLobby(totalValue: 350m, estimateMin: 200m, estimateMax: 600m);
        return war;
    }

    [Fact]
    public void Join_WhenOpen_ShouldAddPendingParticipant()
    {
        var war = CreateOpenWar();
        var userId = Guid.NewGuid();
        var versionBeforeJoin = war.Version;

        war.Join(userId, maxPlayers: 5);

        var participant = Assert.Single(war.Participants);
        Assert.Equal(userId, participant.UserId);
        Assert.Equal(ParticipantState.PendingLock, participant.State);
        Assert.NotEqual(versionBeforeJoin, war.Version);
    }

    [Fact]
    public void Join_WhenNotOpen_ShouldThrowException()
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Throws<WarehouseExceptions.WarNotOpenException>(() => war.Join(Guid.NewGuid(), maxPlayers: 5));
    }

    [Fact]
    public void Join_WhenUserAlreadyJoined_ShouldThrowException()
    {
        var war = CreateOpenWar();
        var userId = Guid.NewGuid();
        war.Join(userId, maxPlayers: 5);

        Assert.Throws<WarehouseExceptions.AlreadyParticipantException>(() => war.Join(userId, maxPlayers: 5));
    }

    [Fact]
    public void Join_WhenLobbyIsFull_ShouldThrowException()
    {
        var war = CreateOpenWar();
        war.Join(Guid.NewGuid(), maxPlayers: 2);
        war.Join(Guid.NewGuid(), maxPlayers: 2);

        Assert.Throws<WarehouseExceptions.WarehouseFullException>(() => war.Join(Guid.NewGuid(), maxPlayers: 2));
    }

    [Fact]
    public void Leave_WhenParticipant_ShouldRemoveParticipant()
    {
        var war = CreateOpenWar();
        var userId = Guid.NewGuid();
        war.Join(userId, maxPlayers: 5);

        war.Leave(userId);

        Assert.Empty(war.Participants);
    }

    [Fact]
    public void Leave_WhenNotParticipant_ShouldThrowException()
    {
        var war = CreateOpenWar();

        Assert.Throws<WarehouseExceptions.ParticipantNotFoundException>(() => war.Leave(Guid.NewGuid()));
    }

    private static readonly TimeSpan Countdown = TimeSpan.FromSeconds(30);

    private static Guid JoinAndConfirm(WarehouseWar war, int minPlayers, int maxPlayers)
    {
        var userId = Guid.NewGuid();
        war.Join(userId, maxPlayers);
        war.ConfirmParticipant(userId, minPlayers, maxPlayers, Countdown);
        return userId;
    }

    [Fact]
    public void ConfirmParticipant_WhenBelowMinimum_ShouldActivateWithoutCountdown()
    {
        var war = CreateOpenWar();

        var userId = JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);

        var participant = Assert.Single(war.Participants);
        Assert.Equal(userId, participant.UserId);
        Assert.Equal(ParticipantState.Active, participant.State);
        Assert.Null(war.BiddingStartsOn);
    }

    [Fact]
    public void ConfirmParticipant_WhenMinimumReached_ShouldStartCountdown()
    {
        var war = CreateOpenWar();

        for (var i = 0; i < 3; i++) JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);

        Assert.NotNull(war.BiddingStartsOn);
        Assert.InRange(war.BiddingStartsOn.Value,
            DateTime.UtcNow + Countdown - TimeSpan.FromSeconds(5), DateTime.UtcNow + Countdown);
        Assert.Equal(WarehouseWarStatus.Open, war.Status);
    }

    [Fact]
    public void ConfirmParticipant_WhenCountdownAlreadyRuns_ShouldNotResetClock()
    {
        var war = CreateOpenWar();
        for (var i = 0; i < 3; i++) JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);
        var startedOn = war.BiddingStartsOn;

        JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);

        Assert.Equal(startedOn, war.BiddingStartsOn);
    }

    [Fact]
    public void ConfirmParticipant_WhenLobbyIsFull_ShouldStartImmediately()
    {
        var war = CreateOpenWar();

        for (var i = 0; i < 3; i++) JoinAndConfirm(war, minPlayers: 3, maxPlayers: 3);

        Assert.NotNull(war.BiddingStartsOn);
        Assert.True(war.BiddingStartsOn <= DateTime.UtcNow);
    }

    [Fact]
    public void ConfirmParticipant_WhenNotOpen_ShouldThrowException()
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Throws<WarehouseExceptions.WarNotOpenException>(
            () => war.ConfirmParticipant(Guid.NewGuid(), 3, 5, Countdown));
    }

    [Fact]
    public void ConfirmParticipant_WhenParticipantMissing_ShouldThrowException()
    {
        var war = CreateOpenWar();

        Assert.Throws<WarehouseExceptions.ParticipantNotFoundException>(
            () => war.ConfirmParticipant(Guid.NewGuid(), 3, 5, Countdown));
    }

    [Fact]
    public void RemoveParticipant_ShouldFreeSeat()
    {
        var war = CreateOpenWar();
        var userId = Guid.NewGuid();
        war.Join(userId, maxPlayers: 1);

        war.RemoveParticipant(userId);

        war.Join(Guid.NewGuid(), maxPlayers: 1);
        Assert.Single(war.Participants);
    }

    [Fact]
    public void RemoveParticipant_WhenParticipantMissing_ShouldThrowException()
    {
        var war = CreateOpenWar();

        Assert.Throws<WarehouseExceptions.ParticipantNotFoundException>(() => war.RemoveParticipant(Guid.NewGuid()));
    }

    [Fact]
    public void Cancel_WhenOpen_ShouldStoreReason()
    {
        var war = CreateOpenWar();
        var versionBeforeCancel = war.Version;

        war.Cancel("Lobby timed out");

        Assert.Equal(WarehouseWarStatus.Cancelled, war.Status);
        Assert.Equal("Lobby timed out", war.CancellationReason);
        Assert.NotEqual(versionBeforeCancel, war.Version);
    }

    [Fact]
    public void Cancel_WhenStocking_ShouldCancel()
    {
        var war = WarehouseWar.Create("Small", 500m);

        war.Cancel("Stock quote timed out");

        Assert.Equal(WarehouseWarStatus.Cancelled, war.Status);
    }

    [Fact]
    public void Cancel_WhenAlreadyCancelled_ShouldThrowException()
    {
        var war = CreateOpenWar();
        war.Cancel("Lobby timed out");

        Assert.Throws<WarehouseExceptions.InvalidWarStateTransitionException>(() => war.Cancel("Lobby timed out"));
    }

    private static readonly TimeSpan RaiseWindow = TimeSpan.FromSeconds(10);

    [Fact]
    public void StartBidding_WhenMinimumIsActive_ShouldOpenFirstRaiseWindow()
    {
        var war = CreateOpenWar();
        for (var i = 0; i < 3; i++) JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);

        war.StartBidding(minPlayers: 3, RaiseWindow);

        Assert.Equal(WarehouseWarStatus.Bidding, war.Status);
        Assert.NotNull(war.BiddingEndsOn);
        Assert.InRange(war.BiddingEndsOn.Value,
            DateTime.UtcNow + RaiseWindow - TimeSpan.FromSeconds(5), DateTime.UtcNow + RaiseWindow);
    }

    [Fact]
    public void StartBidding_WhenPlayerLeftDuringCountdown_ShouldThrowException()
    {
        var war = CreateOpenWar();
        var leaver = JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);
        for (var i = 0; i < 2; i++) JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);
        war.Leave(leaver);

        Assert.Throws<WarehouseExceptions.NotEnoughPlayersException>(() => war.StartBidding(3, RaiseWindow));
        Assert.Equal(WarehouseWarStatus.Open, war.Status);
    }

    [Fact]
    public void StartBidding_WhenCountdownNeverScheduled_ShouldThrowException()
    {
        var war = CreateOpenWar();

        Assert.Throws<WarehouseExceptions.CountdownNotStartedException>(() => war.StartBidding(3, RaiseWindow));
    }

    [Fact]
    public void StartBidding_WhenNotOpen_ShouldThrowException()
    {
        var war = WarehouseWar.Create("Small", 500m);

        Assert.Throws<WarehouseExceptions.InvalidWarStateTransitionException>(() => war.StartBidding(3, RaiseWindow));
    }

    private static readonly List<decimal> Increments = [10m, 50m, 100m, 500m];

    private static WarehouseWar CreateBiddingWar(out Guid[] players, TimeSpan? firstWindow = null)
    {
        var war = CreateOpenWar();
        players = [Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()];
        foreach (var player in players)
        {
            war.Join(player, maxPlayers: 5);
            war.ConfirmParticipant(player, minPlayers: 3, maxPlayers: 5, Countdown);
        }
        war.StartBidding(minPlayers: 3, firstWindow ?? RaiseWindow);
        return war;
    }

    [Fact]
    public void Raise_WhenFirstRaise_ShouldSetLeaderAndExtendWindow()
    {
        var war = CreateBiddingWar(out var players);
        var versionBeforeRaise = war.Version;

        war.Raise(players[0], 50m, Increments, RaiseWindow);

        Assert.Equal(players[0], war.CurrentLeaderId);
        Assert.Equal(50m, war.CurrentPrice);
        Assert.NotNull(war.BiddingEndsOn);
        Assert.InRange(war.BiddingEndsOn.Value,
            DateTime.UtcNow + RaiseWindow - TimeSpan.FromSeconds(5), DateTime.UtcNow + RaiseWindow);
        Assert.NotEqual(versionBeforeRaise, war.Version);
    }

    [Fact]
    public void Raise_WhenAnotherPlayerOutbids_ShouldAccumulatePrice()
    {
        var war = CreateBiddingWar(out var players);

        war.Raise(players[0], 50m, Increments, RaiseWindow);
        war.Raise(players[1], 100m, Increments, RaiseWindow);

        Assert.Equal(players[1], war.CurrentLeaderId);
        Assert.Equal(150m, war.CurrentPrice);
    }

    [Fact]
    public void Raise_WhenNotBidding_ShouldThrowException()
    {
        var war = CreateOpenWar();
        var userId = Guid.NewGuid();
        war.Join(userId, maxPlayers: 5);

        Assert.Throws<WarehouseExceptions.WarNotBiddingException>(
            () => war.Raise(userId, 50m, Increments, RaiseWindow));
    }

    [Fact]
    public void Raise_WhenWindowExpired_ShouldThrowException()
    {
        var war = CreateBiddingWar(out var players, firstWindow: TimeSpan.FromSeconds(-1));

        Assert.Throws<WarehouseExceptions.RaiseWindowClosedException>(
            () => war.Raise(players[0], 50m, Increments, RaiseWindow));
    }

    [Fact]
    public void Raise_WhenCallerIsLeader_ShouldThrowException()
    {
        var war = CreateBiddingWar(out var players);
        war.Raise(players[0], 50m, Increments, RaiseWindow);

        Assert.Throws<WarehouseExceptions.AlreadyLeadingException>(
            () => war.Raise(players[0], 50m, Increments, RaiseWindow));
    }

    [Fact]
    public void Raise_WhenCallerIsNotParticipant_ShouldThrowException()
    {
        var war = CreateBiddingWar(out _);

        Assert.Throws<WarehouseExceptions.ParticipantNotFoundException>(
            () => war.Raise(Guid.NewGuid(), 50m, Increments, RaiseWindow));
    }

    [Fact]
    public void Raise_WhenEntryFeeNotConfirmed_ShouldThrowException()
    {
        var war = CreateOpenWar();
        var pending = Guid.NewGuid();
        war.Join(pending, maxPlayers: 5);
        for (var i = 0; i < 3; i++) JoinAndConfirm(war, minPlayers: 3, maxPlayers: 5);
        war.StartBidding(minPlayers: 3, RaiseWindow);

        Assert.Throws<WarehouseExceptions.ParticipantNotActiveException>(
            () => war.Raise(pending, 50m, Increments, RaiseWindow));
    }

    [Fact]
    public void Raise_WhenIncrementIsNotAllowed_ShouldThrowException()
    {
        var war = CreateBiddingWar(out var players);

        Assert.Throws<WarehouseExceptions.InvalidIncrementException>(
            () => war.Raise(players[0], 25m, Increments, RaiseWindow));
    }

    [Fact]
    public void Raise_WhenBudgetWouldBeExceeded_ShouldThrowException()
    {
        var war = CreateBiddingWar(out var players);
        war.Raise(players[0], 500m, Increments, RaiseWindow);

        Assert.Throws<WarehouseExceptions.BudgetExceededException>(
            () => war.Raise(players[1], 10m, Increments, RaiseWindow));
        Assert.Equal(500m, war.CurrentPrice);
    }

    [Fact]
    public void Raise_WhenPriceReachesEntryFee_ShouldAllowExactBudget()
    {
        var war = CreateBiddingWar(out var players);

        war.Raise(players[0], 500m, Increments, RaiseWindow);

        Assert.Equal(500m, war.CurrentPrice);
    }

    [Fact]
    public void Raise_WhenLeaderCallsAfterWindowExpired_ShouldReportClosedWindow()
    {
        var war = CreateBiddingWar(out var players);
        war.Raise(players[0], 50m, Increments, TimeSpan.FromSeconds(-1));

        Assert.Throws<WarehouseExceptions.RaiseWindowClosedException>(
            () => war.Raise(players[0], 50m, Increments, RaiseWindow));
    }

    [Fact]
    public void Settle_WhenLeaderExists_ShouldClose()
    {
        var war = CreateBiddingWar(out var players);
        war.Raise(players[0], 50m, Increments, RaiseWindow);
        var versionBeforeSettle = war.Version;

        war.Settle();

        Assert.Equal(WarehouseWarStatus.Settled, war.Status);
        Assert.Equal(players[0], war.CurrentLeaderId);
        Assert.NotEqual(versionBeforeSettle, war.Version);
    }

    [Fact]
    public void Settle_WhenNobodyBid_ShouldThrowException()
    {
        var war = CreateBiddingWar(out _);

        Assert.Throws<WarehouseExceptions.NoLeaderException>(() => war.Settle());
    }

    [Fact]
    public void Settle_WhenNotBidding_ShouldThrowException()
    {
        var war = CreateOpenWar();

        Assert.Throws<WarehouseExceptions.InvalidWarStateTransitionException>(() => war.Settle());
    }
}
