using AuctionServer.Modules.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace AuctionServer.Modules.Identity.Infrastructure.Configuration;

internal sealed class IdentityConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.Email).IsUnique();
        builder.Property(x => x.Email).HasMaxLength(64);
        builder.Property(x => x.Name).HasMaxLength(32);
        builder.Property(x => x.Surname).HasMaxLength(32);
        builder.Property(x => x.Username).HasMaxLength(32);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}