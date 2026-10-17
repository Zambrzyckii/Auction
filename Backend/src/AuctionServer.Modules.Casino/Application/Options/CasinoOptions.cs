namespace AuctionServer.Modules.Casino.Application.Options;

public sealed record CasinoOptions(
    TimeSpan PurchaseTimeout,
    RouletteOptions Roulette,
    BlackjackOptions Blackjack);

public sealed record RouletteOptions(decimal MinBet, decimal MaxBet, int MaxBetsPerSpin);

public sealed record BlackjackOptions(decimal MinBet, decimal MaxBet, TimeSpan HandTimeout);
