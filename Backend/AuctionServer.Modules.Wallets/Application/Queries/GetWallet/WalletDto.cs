namespace AuctionServer.Modules.Wallets.Application.Queries.GetWallet;

public record WalletDto(decimal AvailableFunds, decimal LockedFunds);