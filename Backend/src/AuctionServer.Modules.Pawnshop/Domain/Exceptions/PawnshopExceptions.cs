using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Pawnshop.Domain.Exceptions;

public static class PawnshopExceptions
{
    public sealed class PawnshopNotFoundException()
        : AppException("Pawnshop was not found", 404);

    public sealed class PawnshopAlreadyOwnedException()
        : AppException("User already owns a pawnshop", 409);

    public sealed class InvalidShopStateTransitionException(ShopStatus status)
        : AppException($"Shop in status {status} cannot accept this transition", 409);

    public sealed class BotTierNotFoundException(string tierName)
        : AppException($"Bot tier '{tierName}' was not found", 404);

    public sealed class PawnshopNotActiveException()
        : AppException("Pawnshop is not active", 409);

    public sealed class PaymentInProgressException()
        : AppException("Another payment for this pawnshop is already in progress", 409);

    public sealed class BotNotAnUpgradeException()
        : AppException("A new bot must be of a higher tier than the current one", 409);

    public sealed class EventAlreadyProcessedException()
        : AppException("Event was already processed", 409);
}
