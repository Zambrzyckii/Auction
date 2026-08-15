using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Wallets.Domain.Exceptions;

public static class WalletExceptions
{
    public class InsufficientFundsException() : AppException("Not enough funds on account", 400);

    public class InsufficientLockedFundsException() : AppException("Not enough locked funds on account",400);

    public class InvalidAmountException() : AppException("Amount must be greater than zero",400);

    public class UserWithThisIdDontHaveWallet(Guid publicUserId)
        : AppException($"User with this ID {publicUserId} doesnt exists", 404);
    public class WalletAlreadyExistException() : AppException("Wallet already exists",409);
}