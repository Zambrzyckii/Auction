using AuctionServer.Modules.Profiles.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Profiles.Infrastructure.Configuration;

internal sealed class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> builder)
    {
        builder.HasKey(x => x.UserId);
        builder.Property(x => x.Username).HasMaxLength(64);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.ToTable("ProfilesUserProfiles");
    }
}
