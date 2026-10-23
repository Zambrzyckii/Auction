namespace AuctionServer.Api.Tests.IntegrationTests.PgBouncer;

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class PgBouncerCollection : ICollectionFixture<PgBouncerFixture>
{
    public const string Name = "PgBouncer";
}
