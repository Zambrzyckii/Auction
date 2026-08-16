namespace AuctionServer.Shared.Integration.Exceptions;

public abstract class AppException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public class RequestValidationException(string message) : AppException(message, 400);