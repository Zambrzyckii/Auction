using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Modules.Profiles.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Profiles;

public static class ProfilesModuleExtensions
{
    public static IServiceCollection AddProfilesModule(this IServiceCollection services, string connectionString,
        ProfilesOptions options)
    {
        ValidateOptions(options);

        services.AddDbContext<ProfilesDbContext>(o => o.UseNpgsql(connectionString));
        services.AddSingleton(options);
        services.AddScoped<IProfilesRepository, ProfilesRepository>();
        services.AddSingleton<IAvatarStorage>(sp =>
            new S3AvatarStorage(sp.GetRequiredService<ProfilesOptions>().Storage));

        return services;
    }

    private static void ValidateOptions(ProfilesOptions options)
    {
        if (options.Avatar is null || options.Invites is null || options.Storage is null)
            throw new ArgumentException("Avatar, Invites and Storage sections are required", nameof(options));
        if (options.Avatar.MaxBytes is < 1024 or > 5 * 1024 * 1024)
            throw new ArgumentException("Avatar max bytes must be between one kilobyte and five megabytes", nameof(options));
        if (options.Invites.Lifetime < TimeSpan.FromMinutes(1))
            throw new ArgumentException("Invite lifetime must be at least one minute", nameof(options));
        if (!Uri.TryCreate(options.Storage.ServiceUrl, UriKind.Absolute, out var serviceUrl)
            || serviceUrl.Scheme is not ("http" or "https"))
            throw new ArgumentException("Storage service url must be an absolute http or https url", nameof(options));
        if (options.Storage.Bucket is null || options.Storage.Bucket.Length is < 3 or > 63)
            throw new ArgumentException("Storage bucket name must be between three and sixty-three characters", nameof(options));
    }
}
