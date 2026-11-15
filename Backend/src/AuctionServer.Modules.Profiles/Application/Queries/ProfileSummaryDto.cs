namespace AuctionServer.Modules.Profiles.Application.Queries;

public record ProfileSummaryDto(Guid UserId, string Username, string? AvatarUrl);
