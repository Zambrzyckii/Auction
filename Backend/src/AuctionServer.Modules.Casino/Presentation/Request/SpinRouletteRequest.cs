using AuctionServer.Modules.Casino.Application.Command.SpinRoulette;

namespace AuctionServer.Modules.Casino.Presentation.Request;

public record SpinRouletteRequest(IReadOnlyList<RouletteBetRequest> Bets);
