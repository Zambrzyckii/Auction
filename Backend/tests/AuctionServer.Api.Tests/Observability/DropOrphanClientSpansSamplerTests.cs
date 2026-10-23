using System.Diagnostics;
using AuctionServer.Api.Infrastructure.Observability;
using OpenTelemetry.Trace;

namespace AuctionServer.Api.Tests.Observability;

public class DropOrphanClientSpansSamplerTests
{
    private static SamplingParameters RootSpan(
        ActivityKind kind, string name, params KeyValuePair<string, object?>[] tags)
    {
        return new SamplingParameters(
            parentContext: default,
            traceId: ActivityTraceId.CreateRandom(),
            name: name,
            kind: kind,
            tags: tags);
    }

    [Theory]
    [InlineData("db.system")]
    [InlineData("db.system.name")]
    public void ShouldSample_ForRootDatabaseSpan_ShouldDrop(string tagKey)
    {
        var sampler = new DropOrphanClientSpansSampler(new AlwaysOnSampler());
        var parameters = RootSpan(ActivityKind.Client, "auctionserver",
            new KeyValuePair<string, object?>(tagKey, "postgresql"));

        var result = sampler.ShouldSample(in parameters);

        Assert.Equal(SamplingDecision.Drop, result.Decision);
    }

    [Fact]
    public void ShouldSample_ForRootClientSpanWithoutTags_ShouldDrop()
    {
        var sampler = new DropOrphanClientSpansSampler(new AlwaysOnSampler());
        var parameters = RootSpan(ActivityKind.Client, "GET api.example.com");

        var result = sampler.ShouldSample(in parameters);

        Assert.Equal(SamplingDecision.Drop, result.Decision);
    }

    [Fact]
    public void ShouldSample_ForRootServerSpan_ShouldDelegateToInner()
    {
        var sampler = new DropOrphanClientSpansSampler(new AlwaysOnSampler());
        var parameters = RootSpan(ActivityKind.Server, "GET /api/auctions");

        var result = sampler.ShouldSample(in parameters);

        Assert.Equal(SamplingDecision.RecordAndSample, result.Decision);
    }

    [Fact]
    public void ShouldSample_ForRootInternalSpan_ShouldDelegateToInner()
    {
        var sampler = new DropOrphanClientSpansSampler(new AlwaysOnSampler());
        var parameters = RootSpan(ActivityKind.Internal, "custom-operation");

        var result = sampler.ShouldSample(in parameters);

        Assert.Equal(SamplingDecision.RecordAndSample, result.Decision);
    }
}
