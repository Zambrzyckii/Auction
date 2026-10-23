using OpenTelemetry.Trace;
using System.Diagnostics;

namespace AuctionServer.Api.Infrastructure.Observability;

public sealed class DropOrphanDatabaseSpansSampler(Sampler inner) : Sampler
{
    public override SamplingResult ShouldSample(in SamplingParameters samplingParameters)
    {
        if (samplingParameters.Kind == ActivityKind.Client && samplingParameters.Tags?.Any(tag => tag.Key == "db.system") == true)
            return new SamplingResult(SamplingDecision.Drop);

        return inner.ShouldSample(in samplingParameters);
    }
}
