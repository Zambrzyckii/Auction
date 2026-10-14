namespace AuctionServer.Modules.Wallets.Application.Queries.GetWalletTransfers;

public record TransferDto(Guid SenderUserId, Guid RecipientUserId, decimal Amount, DateTime SentOn);
