namespace AuctionServer.Modules.Profiles.Application.Options;

public sealed record ProfilesOptions(AvatarOptions Avatar, InviteOptions Invites, StorageOptions Storage);

public sealed record AvatarOptions(int MaxBytes);

public sealed record InviteOptions(TimeSpan Lifetime);

public sealed record StorageOptions(string ServiceUrl, string Bucket, bool ForcePathStyle);
