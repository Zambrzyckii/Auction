namespace AuctionServer.Api.Tests.IntegrationTests.Caching;

[CollectionDefinition("RedisCache")]
public sealed class RedisCacheCollection : ICollectionFixture<RedisFixture>;
