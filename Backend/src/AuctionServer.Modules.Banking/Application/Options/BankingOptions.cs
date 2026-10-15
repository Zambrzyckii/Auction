namespace AuctionServer.Modules.Banking.Application.Options;

public sealed record BankingOptions(
    decimal PenaltyRate,
    TimeSpan CollectionRetryInterval,
    TimeSpan CollectionPendingTimeout,
    TimeSpan ApprovalTimeout,
    IReadOnlyList<LoanOfferDefinition> Offers);

public sealed record LoanOfferDefinition(string Name, decimal Principal, decimal InterestRate, TimeSpan Term, decimal RequiredTurnover);
