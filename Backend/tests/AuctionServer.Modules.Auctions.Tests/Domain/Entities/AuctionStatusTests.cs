using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionStatusTests
{
    private static Auction CreatePending() =>
        Auction.Create(Guid.NewGuid(), Guid.NewGuid(), 10m, DateTime.UtcNow.AddMinutes(10));

    private static Auction CreateActive()
    {
        var auction = CreatePending();
        auction.Activate("Seeded Item", "Common", 10m);
        return auction;
    }

    [Fact]
    public void Activate_WhenPending_ShouldStoreSnapshotSetActiveAndRegenerateVersion()
    {
        var auction = CreatePending();
        var versionBefore = auction.Version;

        auction.Activate("Sword", "Rare", 250m);

        Assert.Equal(AuctionStatus.Active, auction.Status);
        Assert.Equal("Sword", auction.ItemName);
        Assert.Equal("Rare", auction.ItemRarity);
        Assert.Equal(250m, auction.ItemOfficialPrice);
        Assert.NotEqual(versionBefore, auction.Version);
    }

    [Fact]
    public void Activate_WhenAlreadyActive_ShouldThrowInvalidStateTransition()
    {
        var auction = CreateActive();

        Assert.Throws<AuctionExceptions.InvalidAuctionStateTransitionException>(() => auction.Activate("Sword", "Rare", 250m));
    }

    [Fact]
    public void Cancel_WhenPending_ShouldSetCancelledAndStoreReason()
    {
        var auction = CreatePending();

        auction.Cancel("Item is not available");

        Assert.Equal(AuctionStatus.Cancelled, auction.Status);
        Assert.Equal("Item is not available", auction.CancellationReason);
    }

    [Fact]
    public void Cancel_WhenActive_ShouldThrowInvalidStateTransition()
    {
        var auction = CreateActive();

        Assert.Throws<AuctionExceptions.InvalidAuctionStateTransitionException>(() => auction.Cancel("too late"));
    }

    [Fact]
    public void CloseAuction_WhenPending_ShouldThrowInvalidStateTransition()
    {
        var auction = CreatePending();

        Assert.Throws<AuctionExceptions.InvalidAuctionStateTransitionException>(() => auction.CloseAuction());
    }

    [Fact]
    public void ApplyNewBid_WhenPending_ShouldThrowAuctionNotActive()
    {
        var auction = CreatePending();

        Assert.Throws<AuctionExceptions.AuctionNotActiveException>(() => auction.ApplyNewBid(Guid.NewGuid(), 100m));
    }

    [Fact]
    public void ApplyNewBid_WhenCancelled_ShouldThrowAuctionClosed()
    {
        var auction = CreatePending();
        auction.Cancel("rejected");

        Assert.Throws<AuctionExceptions.AuctionClosedException>(() => auction.ApplyNewBid(Guid.NewGuid(), 100m));
    }
}
