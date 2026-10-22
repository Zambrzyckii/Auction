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
        builder.OwnsMany(x => x.SocialLinks, link =>
        {
            link.ToTable("ProfilesSocialLinks");
            link.WithOwner().HasForeignKey("ProfileUserId");
            link.HasKey("ProfileUserId", nameof(SocialLink.Platform));
            link.Property(x => x.Url).HasMaxLength(200);
        });
        builder.Navigation(x => x.SocialLinks).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.ToTable("ProfilesUserProfiles");
    }
}
