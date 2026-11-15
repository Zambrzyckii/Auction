using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace AuctionServer.Modules.Identity.Application.Tokens;

public static class RefreshTokenSecret
{
    public static string Generate() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
