using System.Text;
using AuctionServer.Modules.Profiles.Domain;

namespace AuctionServer.Modules.Profiles.Tests.Domain;

public class AvatarImageTests
{
    private static byte[] Riff(string format)
    {
        var bytes = new List<byte>();
        bytes.AddRange("RIFF"u8.ToArray());
        bytes.AddRange([0x24, 0x00, 0x00, 0x00]);
        bytes.AddRange(Encoding.ASCII.GetBytes(format));
        bytes.AddRange([0x00, 0x00, 0x00, 0x00]);
        return bytes.ToArray();
    }

    [Fact]
    public void Sniff_JpegMagicBytes_ShouldReturnJpeg()
    {
        byte[] payload = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46];

        Assert.Equal("image/jpeg", AvatarImage.Sniff(payload));
    }

    [Fact]
    public void Sniff_PngSignature_ShouldReturnPng()
    {
        byte[] payload = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];

        Assert.Equal("image/png", AvatarImage.Sniff(payload));
    }

    [Fact]
    public void Sniff_WebpRiffContainer_ShouldReturnWebp()
    {
        Assert.Equal("image/webp", AvatarImage.Sniff(Riff("WEBP")));
    }

    public static TheoryData<string, byte[]> NonAvatarPayloads => new()
    {
        { "empty", [] },
        { "truncated jpeg", [0xFF, 0xD8] },
        { "truncated png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A] },
        { "gif", "GIF89a trailer"u8.ToArray() },
        { "svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"u8.ToArray() },
        { "plain text", "definitely not an image"u8.ToArray() },
        { "riff but wave", Riff("WAVE") },
        { "riff too short for format", "RIFF"u8.ToArray() }
    };

    [Theory]
    [MemberData(nameof(NonAvatarPayloads))]
    public void Sniff_NonAvatarPayload_ShouldReturnNull(string label, byte[] payload)
    {
        Assert.Null(AvatarImage.Sniff(payload));
        Assert.NotEmpty(label);
    }
}
