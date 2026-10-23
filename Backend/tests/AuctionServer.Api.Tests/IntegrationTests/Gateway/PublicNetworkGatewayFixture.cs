using Docker.DotNet.Models;
using DotNet.Testcontainers.Builders;

namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

public sealed class PublicNetworkGatewayFixture() : GatewayFixture(new NetworkBuilder()
    .WithCreateParameterModifier(network => network.IPAM = new IPAM { Config = [new IPAMConfig { Subnet = DocumentationSubnet }] }))
{
    private const string DocumentationSubnet = "203.0.113.0/24";
}
