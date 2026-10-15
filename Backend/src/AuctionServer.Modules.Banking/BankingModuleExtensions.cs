using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Infrastructure.Background;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Banking;

public static class BankingModuleExtensions
{
    // Both saga legs retry with exponential backoff for about five minutes before dead-lettering,
    // so a request plus its reply can stay legitimately in flight for about ten minutes. A timeout
    // below that would let the keeper's safety nets fire while a reply can still arrive.
    private static readonly TimeSpan MinimumTimeout = TimeSpan.FromMinutes(10);

    public static IServiceCollection AddBankingModule(this IServiceCollection services, string connectionString,
        BankingOptions options)
    {
        ValidateOptions(options);

        services.AddDbContext<BankingDbContext>(o => o.UseNpgsql(connectionString));
        services.AddHostedService<OutboxProcessor>();
        services.AddHostedService<BankKeeper>();
        services.AddSingleton(options);
        services.AddScoped<IBankingRepository, BankingRepository>();

        return services;
    }

    private static void ValidateOptions(BankingOptions options)
    {
        if (options.Offers.Count == 0)
            throw new ArgumentException("At least one loan offer is required", nameof(options));
        if (options.Offers.Select(o => o.Name.ToLowerInvariant()).Distinct().Count() != options.Offers.Count)
            throw new ArgumentException("Loan offer names must be unique", nameof(options));
        if (options.PenaltyRate is < 0 or > 1)
            throw new ArgumentException("Penalty rate must be between zero and one", nameof(options));
        if (options.CollectionRetryInterval <= TimeSpan.Zero)
            throw new ArgumentException("Collection retry interval must be positive", nameof(options));
        if (options.CollectionPendingTimeout < MinimumTimeout || options.ApprovalTimeout < MinimumTimeout)
            throw new ArgumentException("Timeouts must outlast the ten-minute dead-letter horizon of a saga round trip", nameof(options));

        foreach (var offer in options.Offers)
        {
            if (string.IsNullOrWhiteSpace(offer.Name) || offer.Name.Length > 64
                || offer.Principal <= 0 || offer.InterestRate is <= 0 or > 1
                || offer.Term < TimeSpan.FromSeconds(10) || offer.RequiredTurnover < 0)
                throw new ArgumentException($"Loan offer '{offer.Name}' is misconfigured", nameof(options));
        }
    }
}
