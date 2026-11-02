using AuctionServer.Api.Infrastructure.Messaging;
using Microsoft.Extensions.Configuration;

namespace AuctionServer.Api.Tests.Messaging;

public class MessagingOptionsTests
{
    private static IConfiguration BuildConfiguration(params (string Key, string Value)[] pairs)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.ToDictionary(p => $"Messaging:{p.Key}", string? (p) => p.Value))
            .Build();
    }

    [Fact]
    public void Load_WhenSectionIsMissing_ShouldDefaultToInProcess()
    {
        var options = MessagingOptions.Load(new ConfigurationBuilder().Build());

        Assert.Equal(MessagingTransport.InProcess, options.Transport);
        Assert.Null(options.Rabbit);
    }

    [Fact]
    public void Load_WhenTransportIsInProcess_ShouldSkipValidation()
    {
        var configuration = BuildConfiguration(("Transport", "InProcess"), ("Rabbit:HostName", " "));

        var options = MessagingOptions.Load(configuration);

        Assert.Equal(MessagingTransport.InProcess, options.Transport);
    }

    [Fact]
    public void Load_WhenTransportIsRabbit_ShouldReturnRabbitOptions()
    {
        var configuration = BuildConfiguration(
            ("Transport", "Rabbit"),
            ("Rabbit:HostName", "rabbitmq"),
            ("Rabbit:UserName", "auction"),
            ("Rabbit:Password", "auction"));

        var options = MessagingOptions.Load(configuration);

        Assert.Equal(MessagingTransport.Rabbit, options.Transport);
        Assert.NotNull(options.Rabbit);
        Assert.Equal("rabbitmq", options.Rabbit.HostName);
        Assert.Equal(5672, options.Rabbit.Port);
    }

    [Fact]
    public void Load_WhenRabbitSectionIsMissing_ShouldThrow()
    {
        var configuration = BuildConfiguration(("Transport", "Rabbit"));

        var exception = Assert.Throws<InvalidOperationException>(() => MessagingOptions.Load(configuration));

        Assert.Contains("Messaging:Rabbit", exception.Message);
    }

    [Fact]
    public void Load_WhenHostNameIsEmpty_ShouldThrow()
    {
        var configuration = BuildConfiguration(("Transport", "Rabbit"), ("Rabbit:HostName", " "));

        var exception = Assert.Throws<InvalidOperationException>(() => MessagingOptions.Load(configuration));

        Assert.Contains("Messaging:Rabbit:HostName", exception.Message);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("65536")]
    public void Load_WhenPortIsOutOfRange_ShouldThrow(string port)
    {
        var configuration = BuildConfiguration(
            ("Transport", "Rabbit"),
            ("Rabbit:HostName", "rabbitmq"),
            ("Rabbit:Port", port));

        var exception = Assert.Throws<InvalidOperationException>(() => MessagingOptions.Load(configuration));

        Assert.Contains("Messaging:Rabbit:Port", exception.Message);
    }

    [Fact]
    public void Load_WhenCredentialsAreEmpty_ShouldNotThrow()
    {
        var configuration = BuildConfiguration(("Transport", "Rabbit"), ("Rabbit:HostName", "rabbitmq"));

        var options = MessagingOptions.Load(configuration);

        Assert.NotNull(options.Rabbit);
        Assert.Equal(string.Empty, options.Rabbit.UserName);
        Assert.Equal(string.Empty, options.Rabbit.Password);
    }
}
