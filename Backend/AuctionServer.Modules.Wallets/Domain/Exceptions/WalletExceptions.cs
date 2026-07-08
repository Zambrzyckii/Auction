namespace AuctionServer.Modules.Wallets.Domain.Exceptions;

public static class WalletExceptions
{
    public class InsufficientFundsException() : ApplicationException("Not enough funds on account");

    public class UserWithThisIdDontHaveWallet(Guid publicUserId)
        : ApplicationException($"User with this ID {publicUserId} doesnt exists");
}