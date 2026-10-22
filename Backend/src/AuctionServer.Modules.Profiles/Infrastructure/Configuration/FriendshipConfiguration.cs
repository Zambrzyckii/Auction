using AuctionServer.Modules.Profiles.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Profiles.Infrastructure.Configuration;

internal sealed class FriendshipConfiguration : IEntityTypeConfiguration<Friendship>
{
    public void Configure(EntityTypeBuilder<Friendship> builder)
    {
        builder.HasKey(x => x.PublicFriendshipId);
        builder.HasIndex(x => new { x.UserLowId, x.UserHighId }).IsUnique();
        builder.HasIndex(x => x.RequesterId);
        builder.HasIndex(x => x.AddresseeId);
        builder.ToTable("ProfilesFriendships");
    }
}
