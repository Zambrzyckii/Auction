namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfile;

public record ProfileDto(Guid UserId, string Username, int Level, DateTime MemberSince);
