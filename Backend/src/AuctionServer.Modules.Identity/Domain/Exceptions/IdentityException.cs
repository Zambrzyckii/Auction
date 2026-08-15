using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Identity.Domain.Exceptions;

public static class IdentityException
{
    public class InvalidCredentialsException(string message) : AppException(message, 400);
    public class MissingConfigurationException() : AppException("Server configuration error", 500);
}