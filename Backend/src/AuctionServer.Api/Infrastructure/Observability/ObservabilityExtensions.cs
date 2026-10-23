using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace AuctionServer.Api.Infrastructure.Observability;

public static class ObservabilityExtensions
{
    public static WebApplicationBuilder AddObservability(this WebApplicationBuilder builder)
    {
        var options = ObservabilityOptions.Load(builder.Configuration);

        if (!options.Enabled) return builder;

        var endpoint = new Uri(options.OtlpEndpoint!);

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(options.ServiceName))
            .WithTracing(tracing => tracing
                .SetSampler(new ParentBasedSampler(
                    new DropOrphanClientSpansSampler(new TraceIdRatioBasedSampler(options.TraceSampleRatio))))
                .AddAspNetCoreInstrumentation(instrumentation =>
                    instrumentation.Filter = context => !context.Request.Path.StartsWithSegments("/health"))
                .AddHttpClientInstrumentation()
                .AddSource("Npgsql")
                .AddSource("AuctionServer.*")
                .AddOtlpExporter(exporter => exporter.Endpoint = endpoint))
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddMeter("Npgsql")
                .AddMeter("AuctionServer.*")
                .AddOtlpExporter((exporter, reader) =>
                {
                    exporter.Endpoint = endpoint;
                    reader.PeriodicExportingMetricReaderOptions.ExportIntervalMilliseconds =
                        options.MetricExportIntervalSeconds * 1000;
                }));

        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeScopes = true;
            logging.IncludeFormattedMessage = true;
            logging.SetResourceBuilder(ResourceBuilder.CreateDefault().AddService(options.ServiceName));
            logging.AddOtlpExporter(exporter => exporter.Endpoint = endpoint);
        });

        return builder;
    }
}
