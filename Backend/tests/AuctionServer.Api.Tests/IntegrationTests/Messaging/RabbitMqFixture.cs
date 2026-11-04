using AuctionServer.Api.Infrastructure.Messaging;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace AuctionServer.Api.Tests.IntegrationTests.Messaging;

[CollectionDefinition(RabbitMqCollection.Name)]
public sealed class RabbitMqCollection : ICollectionFixture<RabbitMqFixture>
{
    public const string Name = "RabbitMq";
}

public sealed class RabbitMqFixture : IAsyncLifetime
{
    public const string Image = "rabbitmq:4.1-alpine";

    private readonly IContainer _container = new ContainerBuilder(Image)
        .WithEnvironment("RABBITMQ_DEFAULT_USER", "auction")
        .WithEnvironment("RABBITMQ_DEFAULT_PASS", "auction")
        .WithPortBinding(5672, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilMessageIsLogged("Server startup complete"))
        .Build();

    public MessagingRabbitOptions Options => new()
    {
        HostName = _container.Hostname,
        Port = _container.GetMappedPublicPort(5672),
        UserName = "auction",
        Password = "auction"
    };

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();
}
