using DotNet.Testcontainers.Builders;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

public sealed class UnreachableUpstreamGatewayFixture() : GatewayFixture(new NetworkBuilder(), withUpstream: false);
