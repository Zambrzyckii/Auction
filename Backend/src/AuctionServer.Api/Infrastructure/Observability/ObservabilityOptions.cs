namespace AuctionServer.Api.Infrastructure.Observability;

public sealed class ObservabilityOptions
{
    public bool Enabled { get; init; }
    public string ServiceName { get; init; } = "auction-server";
    public string? OtlpEndpoint { get; init; }
    public double TraceSampleRatio { get; init; } = 1.0;
    public int MetricExportIntervalSeconds { get; init; } = 10;

    public static ObservabilityOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection("Observability").Get<ObservabilityOptions>() ?? new ObservabilityOptions();

        if (!options.Enabled) return options;

        if (string.IsNullOrWhiteSpace(options.ServiceName))
            throw new InvalidOperationException("Observability:ServiceName must not be blank");
        if (!Uri.TryCreate(options.OtlpEndpoint, UriKind.Absolute, out var endpoint)
            || endpoint.Scheme is not ("http" or "https"))
            throw new InvalidOperationException("Observability:OtlpEndpoint must be an absolute http or https url");
        if (options.TraceSampleRatio is < 0 or > 1)
            throw new InvalidOperationException("Observability:TraceSampleRatio must be within [0, 1]");
        if (options.MetricExportIntervalSeconds is < 1 or > 60)
            throw new InvalidOperationException("Observability:MetricExportIntervalSeconds must be within [1, 60]");

        return options;
    }
}
