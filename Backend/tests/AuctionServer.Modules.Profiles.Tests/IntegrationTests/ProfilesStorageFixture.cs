using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[CollectionDefinition(ProfilesStorageCollection.Name)]
public sealed class ProfilesStorageCollection : ICollectionFixture<ProfilesStorageFixture>
{
    public const string Name = "ProfilesStorage";
}

public sealed class ProfilesStorageFixture : IAsyncLifetime
{
    private readonly IContainer _container = new ContainerBuilder("chrislusf/seaweedfs:4.48")
        .WithCommand("server", "-s3", "-dir=/data")
        .WithPortBinding(8333, true)
        .WithWaitStrategy(Wait.ForUnixContainer()
            .UntilHttpRequestIsSucceeded(request => request.ForPort(8333).ForPath("/")))
        .Build();

    public string ServiceUrl => $"http://{_container.Hostname}:{_container.GetMappedPublicPort(8333)}";

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();
}
