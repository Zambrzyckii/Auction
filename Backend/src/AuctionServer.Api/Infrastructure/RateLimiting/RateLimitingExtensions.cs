using System.Security.Claims;
using System.Threading.RateLimiting;

namespace AuctionServer.Api.Infrastructure.RateLimiting;

public static class RateLimitingExtensions
{
    public const string WritesClass = "writes";
    public const string HotWritesClass = "hot-writes";
    public const string UploadsClass = "uploads";

    public static WebApplicationBuilder AddApiRateLimiting(
        this WebApplicationBuilder builder, RateLimitingOptions options)
    {
        if (!options.Enabled) return builder;

        builder.Services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = static async (context, token) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    context.HttpContext.Response.Headers.RetryAfter =
                        Math.Ceiling(retryAfter.TotalSeconds).ToString();
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync("""{"error":"Too many requests."}""", token);
            };
            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var policyClass = Classify(context.Request.Method, context.Request.Path.Value ?? string.Empty);
                if (policyClass is null) return RateLimitPartition.GetNoLimiter("read");

                var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userId is null) return RateLimitPartition.GetNoLimiter("anonymous");

                var policy = policyClass switch
                {
                    HotWritesClass => options.HotWrites!,
                    UploadsClass => options.Uploads!,
                    _ => options.Writes!
                };
                return RateLimitPartition.GetTokenBucketLimiter($"{policyClass}:{userId}",
                    _ => new TokenBucketRateLimiterOptions
                    {
                        TokenLimit = policy.TokenLimit,
                        TokensPerPeriod = policy.TokensPerPeriod,
                        ReplenishmentPeriod = TimeSpan.FromSeconds(policy.PeriodSeconds),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    });
            });
        });

        return builder;
    }

    public static string? Classify(string method, string path)
    {
        var isWrite = HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsDelete(method);
        if (!isWrite) return null;

        if (HttpMethods.IsPut(method)
            && path.Equals("/api/profiles/me/avatar", StringComparison.OrdinalIgnoreCase))
            return UploadsClass;

        if (HttpMethods.IsPost(method) && IsHotWrite(path)) return HotWritesClass;

        return WritesClass;
    }

    private static bool IsHotWrite(string path)
    {
        if (path.StartsWith("/api/casino/", StringComparison.OrdinalIgnoreCase)) return true;
        if (path.Equals("/api/wallets/transfers", StringComparison.OrdinalIgnoreCase)) return true;
        if (path.StartsWith("/api/auctions/", StringComparison.OrdinalIgnoreCase)
            && path.EndsWith("/bid", StringComparison.OrdinalIgnoreCase)) return true;
        return path.StartsWith("/api/warehouses/", StringComparison.OrdinalIgnoreCase)
               && (path.EndsWith("/bids", StringComparison.OrdinalIgnoreCase)
                   || path.EndsWith("/join", StringComparison.OrdinalIgnoreCase)
                   || path.EndsWith("/leave", StringComparison.OrdinalIgnoreCase));
    }
}
