namespace AuctionServer.Modules.Auctions.Application.Options;

public sealed record AuctionReadCacheOptions
{
    public TimeSpan ListTtl { get; init; } = TimeSpan.FromSeconds(2);
    public TimeSpan DetailTtl { get; init; } = TimeSpan.FromSeconds(2);
    public TimeSpan BidsTtl { get; init; } = TimeSpan.FromSeconds(2);
}
