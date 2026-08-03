using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Identity.Domain.Exceptions;

public sealed class IdentityException
{
    public class InvalidCredentialsException(string message) : AppException(message, 400);
    public class MissingConfigurationException() : AppException("JWT key is empty, check if it's provided or not too short", 400);
}