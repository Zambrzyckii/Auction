using AuctionServer.Modules.Profiles;
using AuctionServer.Modules.Profiles.Application.Options;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Profiles.Tests.Application;

public class ProfilesModuleExtensionsTests
{
    private static ProfilesOptions ValidOptions() => new(
        new AvatarOptions(2 * 1024 * 1024),
        new InviteOptions(TimeSpan.FromMinutes(15)),
        new StorageOptions("http://localhost:8333", "auctionserver-avatars", true));

    private static void Add(ProfilesOptions options) =>
        new ServiceCollection().AddProfilesModule("Host=localhost", options);

    [Fact]
    public void AddProfilesModule_WithValidOptions_ShouldNotThrow() => Add(ValidOptions());

    public static TheoryData<string> InvalidCases => new()
    {
        "missing avatar section",
        "missing invites section",
        "missing storage section",
        "max bytes below one kilobyte",
        "max bytes above five megabytes",
        "invite lifetime below one minute",
        "relative service url",
        "bucket name too short",
        "bucket name too long"
    };

    [Theory]
    [MemberData(nameof(InvalidCases))]
    public void AddProfilesModule_WithInvalidOptions_ShouldThrow(string invalidCase)
    {
        var options = invalidCase switch
        {
            "missing avatar section" => ValidOptions() with { Avatar = null! },
            "missing invites section" => ValidOptions() with { Invites = null! },
            "missing storage section" => ValidOptions() with { Storage = null! },
            "max bytes below one kilobyte" => ValidOptions() with { Avatar = new AvatarOptions(1023) },
            "max bytes above five megabytes" => ValidOptions() with { Avatar = new AvatarOptions(5 * 1024 * 1024 + 1) },
            "invite lifetime below one minute" => ValidOptions() with { Invites = new InviteOptions(TimeSpan.FromSeconds(59)) },
            "relative service url" => ValidOptions() with { Storage = new StorageOptions("seaweedfs:8333", "auctionserver-avatars", true) },
            "bucket name too short" => ValidOptions() with { Storage = new StorageOptions("http://localhost:8333", "ab", true) },
            "bucket name too long" => ValidOptions() with { Storage = new StorageOptions("http://localhost:8333", new string('a', 64), true) },
            _ => throw new ArgumentOutOfRangeException(nameof(invalidCase))
        };

        Assert.Throws<ArgumentException>(() => Add(options));
    }
}
