namespace AuctionServer.Api.Tests;

public class HostAssemblyTests
{
    [Fact]
    public void Program_ShouldBeReachableFromTestProject()
    {
        Assert.Equal("AuctionServer.Api", typeof(Program).Assembly.GetName().Name);
    }
}
