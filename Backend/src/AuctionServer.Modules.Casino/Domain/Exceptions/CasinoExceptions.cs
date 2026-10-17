using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Casino.Domain.Exceptions;

public static class CasinoExceptions
{
    public sealed class InvalidChipAmountException()
        : AppException("Chip amount is not valid", 400);

    public sealed class InsufficientChipsException()
        : AppException("Not enough chips on account", 400);

    public sealed class ChipAccountNotFoundException()
        : AppException("Chip account was not found", 404);

    public sealed class ChipPurchaseNotFoundException()
        : AppException("Chip purchase was not found", 404);

    public sealed class PurchaseInProgressException()
        : AppException("Another chip purchase is already in progress", 409);

    public sealed class InvalidPurchaseStateTransitionException(ChipPurchaseStatus status)
        : AppException($"Chip purchase in status {status} cannot accept this transition", 409);

    public sealed class InvalidRouletteBetsException(string message)
        : AppException(message, 400);

    public sealed class InvalidBlackjackStakeException(string message)
        : AppException(message, 400);

    public sealed class HandNotFoundException()
        : AppException("Blackjack hand was not found", 404);

    public sealed class HandInProgressException()
        : AppException("Another blackjack hand is already in progress", 409);

    public sealed class InvalidBlackjackActionException(string message)
        : AppException(message, 409);

    public sealed class EventAlreadyProcessedException()
        : AppException("Event was already processed", 409);
}
