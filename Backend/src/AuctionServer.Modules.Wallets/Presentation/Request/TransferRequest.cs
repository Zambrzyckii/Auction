namespace AuctionServer.Modules.Wallets.Presentation.Request;

public record TransferRequest(Guid RecipientUserId, decimal Amount);
