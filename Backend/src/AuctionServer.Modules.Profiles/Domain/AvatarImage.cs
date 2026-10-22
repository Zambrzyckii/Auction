namespace AuctionServer.Modules.Profiles.Domain;

public static class AvatarImage
{
    public const string Jpeg = "image/jpeg";
    public const string Png = "image/png";
    public const string Webp = "image/webp";

    private static readonly byte[] JpegSignature = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    public static string? Sniff(ReadOnlySpan<byte> payload)
    {
        if (payload.StartsWith(JpegSignature)) return Jpeg;
        if (payload.StartsWith(PngSignature)) return Png;
        if (payload.Length >= 12 && payload.StartsWith("RIFF"u8) && payload.Slice(8, 4).SequenceEqual("WEBP"u8))
            return Webp;
        return null;
    }
}
