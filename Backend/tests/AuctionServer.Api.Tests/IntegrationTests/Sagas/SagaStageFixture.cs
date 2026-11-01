using AuctionServer.TestSupport;

namespace AuctionServer.Api.Tests.IntegrationTests.Sagas;

[CollectionDefinition(SagaStageCollection.Name)]
public sealed class SagaStageCollection : ICollectionFixture<SagaStageFixture>
{
    public const string Name = "SagaStage";
}

public sealed class SagaStageFixture : SagaStage<Program>;
