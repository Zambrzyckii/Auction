namespace AuctionServer.Modules.Wallets.Domain;

public static class PlayerLevels
{
    public const int MaxRewardedLevel = 100;

    public static decimal TurnoverRequired(int level) => 1000m * level * level;
    public static decimal Reward(int level) => 10m * level * level;
}
