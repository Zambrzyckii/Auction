namespace AuctionServer.Shared.Integration.Messaging;

/// <summary>
/// The event transport (the message broker) cannot be reached at all. A failure of the
/// transport is not a failure of the message: the outbox must keep the row pending
/// instead of counting an attempt against it.
/// </summary>
public sealed class TransportUnavailableException(string message, Exception innerException)
    : Exception(message, innerException);
