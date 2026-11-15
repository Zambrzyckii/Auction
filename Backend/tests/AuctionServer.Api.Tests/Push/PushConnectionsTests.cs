using AuctionServer.Api.Infrastructure.Push;

namespace AuctionServer.Api.Tests.Push;

public class PushConnectionsTests
{
    private static readonly PushOptions Options = new(TimeSpan.FromSeconds(15), BufferSize: 2, MaxStreamsPerUser: 2);
    private static readonly Guid Alice = Guid.NewGuid();
    private static readonly Guid Bob = Guid.NewGuid();

    private static List<string> Topics(IPushSubscription subscription)
    {
        var topics = new List<string>();
        while (subscription.Reader.TryRead(out var message)) topics.Add(message.Topic);
        return topics;
    }

    [Fact]
    public void SendToUser_ShouldReachOnlyThatUsersStreams()
    {
        var connections = new PushConnections(Options);
        using var alice = connections.Subscribe(Alice);
        using var bob = connections.Subscribe(Bob);

        connections.SendToUser(Alice, PushMessage.Of(PushTopics.WalletChanged));

        Assert.Equal(new[] { PushTopics.WalletChanged }, Topics(alice));
        Assert.Empty(Topics(bob));
    }

    [Fact]
    public void Broadcast_ShouldReachEveryStreamIncludingTwoTabsOfOneUser()
    {
        var connections = new PushConnections(Options);
        using var firstTab = connections.Subscribe(Alice);
        using var secondTab = connections.Subscribe(Alice);
        using var bob = connections.Subscribe(Bob);

        connections.Broadcast(PushMessage.AuctionChanged(Guid.NewGuid()));

        Assert.Equal(new[] { PushTopics.AuctionChanged }, Topics(firstTab));
        Assert.Equal(new[] { PushTopics.AuctionChanged }, Topics(secondTab));
        Assert.Equal(new[] { PushTopics.AuctionChanged }, Topics(bob));
        Assert.Equal(3, connections.StreamCount);
    }

    [Fact]
    public void Subscribe_BeyondMaxStreamsPerUser_ShouldCloseTheOldestStreamOfThatUser()
    {
        var connections = new PushConnections(Options);
        using var oldest = connections.Subscribe(Alice);
        using var middle = connections.Subscribe(Alice);
        using var bob = connections.Subscribe(Bob);

        using var newest = connections.Subscribe(Alice);

        Assert.True(oldest.Reader.Completion.IsCompleted);
        Assert.False(middle.Reader.Completion.IsCompleted);
        Assert.False(bob.Reader.Completion.IsCompleted);
        connections.SendToUser(Alice, PushMessage.Of(PushTopics.WalletChanged));
        Assert.Empty(Topics(oldest));
        Assert.Single(Topics(middle));
        Assert.Single(Topics(newest));
        Assert.Equal(3, connections.StreamCount);
    }

    [Fact]
    public void SendToUser_WhenTheBufferIsFull_ShouldDropTheOldestMessage()
    {
        var connections = new PushConnections(Options);
        using var alice = connections.Subscribe(Alice);

        connections.SendToUser(Alice, PushMessage.Of("first"));
        connections.SendToUser(Alice, PushMessage.Of("second"));
        connections.SendToUser(Alice, PushMessage.Of("third"));

        Assert.Equal(new[] { "second", "third" }, Topics(alice));
    }

    [Fact]
    public void Dispose_ShouldUnregisterAndCompleteTheStream()
    {
        var connections = new PushConnections(Options);
        var alice = connections.Subscribe(Alice);

        alice.Dispose();
        connections.SendToUser(Alice, PushMessage.Of(PushTopics.WalletChanged));

        Assert.True(alice.Reader.Completion.IsCompleted);
        Assert.Empty(Topics(alice));
        Assert.Equal(0, connections.StreamCount);
    }

    [Fact]
    public void Dispose_Twice_ShouldBeHarmless()
    {
        var connections = new PushConnections(Options);
        var alice = connections.Subscribe(Alice);
        using var other = connections.Subscribe(Alice);

        alice.Dispose();
        alice.Dispose();

        Assert.Equal(1, connections.StreamCount);
    }
}
