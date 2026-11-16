namespace AuctionServer.Modules.Identity.Application.Tokens;

public sealed record SessionTokensDto(string Token, string? RefreshToken);
