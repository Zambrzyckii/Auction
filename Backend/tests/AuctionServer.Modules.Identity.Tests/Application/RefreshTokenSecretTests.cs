using AuctionServer.Modules.Identity.Application.Tokens;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class RefreshTokenSecretTests
{
    [Fact]
    public void Generate_ShouldReturn43UrlSafeCharacters()
    {
        var value = RefreshTokenSecret.Generate();

        Assert.Matches("^[A-Za-z0-9_-]{43}$", value);
    }

    [Fact]
    public void Generate_ShouldReturnADifferentValueEachTime()
    {
        Assert.NotEqual(RefreshTokenSecret.Generate(), RefreshTokenSecret.Generate());
    }

    [Fact]
    public void Hash_ShouldReturnLowercaseSha256Hex()
    {
        Assert.Equal("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", RefreshTokenSecret.Hash("abc"));
    }
}
