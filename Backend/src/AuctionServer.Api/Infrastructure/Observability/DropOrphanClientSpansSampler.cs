using OpenTelemetry.Trace;
using System.Diagnostics;

namespace AuctionServer.Api.Infrastructure.Observability;

public sealed class DropOrphanClientSpansSampler(Sampler inner) : Sampler
{
    public override SamplingResult ShouldSample(in SamplingParameters samplingParameters)
    {
        if (samplingParameters.Kind == ActivityKind.Client)
            return new SamplingResult(SamplingDecision.Drop);

        return inner.ShouldSample(in samplingParameters);
    }
}
