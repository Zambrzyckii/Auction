using AuctionServer.Modules.Banking.Domain.Enums;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Banking.Domain.Exceptions;

public static class BankingExceptions
{
    public sealed class LoanNotFoundException(Guid publicLoanId)
        : AppException($"Loan with id {publicLoanId} was not found", 404);

    public sealed class LoanOfferNotFoundException(string offerName)
        : AppException($"Loan offer '{offerName}' was not found", 404);

    public sealed class LoanAlreadyActiveException()
        : AppException("User already has an open loan", 409);

    public sealed class InvalidLoanTermsException()
        : AppException("Loan terms must be positive", 400);

    public sealed class InvalidLoanStateTransitionException(LoanStatus from, LoanStatus to)
        : AppException($"Loan cannot move from {from} to {to}", 409);

    public sealed class LoanCollectionInProgressException()
        : AppException("A collection for this loan is already in progress", 409);

    public sealed class LoanAlreadyRepaidException()
        : AppException("Loan is already repaid", 409);

    public sealed class InvalidCollectionAmountException()
        : AppException("Collected amount must be between zero and the outstanding debt", 400);

    public sealed class EventAlreadyProcessedException()
        : AppException("Event was already processed", 409);
}
