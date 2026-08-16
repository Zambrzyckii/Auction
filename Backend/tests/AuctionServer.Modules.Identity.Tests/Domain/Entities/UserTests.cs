using AuctionServer.Modules.Identity.Domain.Entities;

namespace AuctionServer.Modules.Identity.Tests.Domain.Entities;

public class UserTests
{
    private static User CreateUser() =>
        new("user@test.com", "hash", "username", "Jan", "Kowalski", new DateOnly(2000, 1, 1));

    [Fact]
    public void Constructor_ShouldStartWithUserRoleAndNotDeleted()
    {
        var user = CreateUser();

        Assert.Equal(Role.User, user.UserRoles);
        Assert.False(user.IsDeleted);
        Assert.NotEqual(Guid.Empty, user.PublicUserId);
    }

    [Fact]
    public void DeleteThisUser_ShouldMarkAsDeleted()
    {
        var user = CreateUser();

        user.DeleteThisUser();

        Assert.True(user.IsDeleted);
    }
}
