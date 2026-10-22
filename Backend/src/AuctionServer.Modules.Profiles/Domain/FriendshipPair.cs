namespace AuctionServer.Modules.Profiles.Domain;

public static class FriendshipPair
{
    public static (Guid Low, Guid High) Normalize(Guid first, Guid second)
    {
        if (first.CompareTo(second) <= 0) return (first, second);
        return (second, first);
    }
}
