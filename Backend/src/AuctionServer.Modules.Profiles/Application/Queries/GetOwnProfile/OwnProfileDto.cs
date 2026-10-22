namespace AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;

public record OwnProfileDto(Guid UserId, string Username, int Level, DateTime MemberSince);
