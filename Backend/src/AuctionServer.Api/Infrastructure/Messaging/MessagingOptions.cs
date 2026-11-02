namespace AuctionServer.Api.Infrastructure.Messaging;

public enum MessagingTransport
{
    InProcess,
    Rabbit
}

public sealed class MessagingOptions
{
    public MessagingTransport Transport { get; init; } = MessagingTransport.InProcess;
    public MessagingRabbitOptions? Rabbit { get; init; }

    public static MessagingOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("Messaging").Get<MessagingOptions>() ?? new MessagingOptions();

        if (options.Transport == MessagingTransport.InProcess) return options;

        if (options.Rabbit is null)
            throw new InvalidOperationException("Messaging:Rabbit section must be present when the transport is Rabbit");
        if (string.IsNullOrWhiteSpace(options.Rabbit.HostName))
            throw new InvalidOperationException("Messaging:Rabbit:HostName must not be empty when the transport is Rabbit");
        if (options.Rabbit.Port is < 1 or > 65535)
            throw new InvalidOperationException($"Messaging:Rabbit:Port must be within [1, 65535], got {options.Rabbit.Port}");

        return options;
    }
}

public sealed class MessagingRabbitOptions
{
    public string HostName { get; init; } = string.Empty;
    public int Port { get; init; } = 5672;
    public string UserName { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}
