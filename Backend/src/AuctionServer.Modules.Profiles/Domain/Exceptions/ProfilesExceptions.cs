using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Profiles.Domain.Exceptions;

public static class ProfilesExceptions
{
    public sealed class ProfileNotFoundException()
        : AppException("Profile was not found", 404);

    public sealed class EventAlreadyProcessedException()
        : AppException("Event was already processed", 409);

    public sealed class InvalidSocialLinkException(string message)
        : AppException(message, 400);
}
