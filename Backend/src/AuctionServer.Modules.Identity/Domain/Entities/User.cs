
namespace AuctionServer.Modules.Identity.Domain.Entities;

public sealed class User(string email, string passwordHash, string username, string name, string surname, DateOnly birthday)
{
    public Guid PublicUserId { get; init; } = Guid.NewGuid();
    public int Id { get; init; }
    public string Email { get; private set; } = email;
    public string PasswordHash { get; private set; } = passwordHash;
    public string Username { get; private set; } = username;
    public string Name { get; private set; } = name;
    public string Surname { get; private set; } = surname;
    public DateOnly Birthday { get; init; } = birthday;
    public bool IsDeleted { get; private set; }
    public Role UserRoles { get; private set; } = Role.User;

    public void ChangeEmail(string newEmail) => Email = newEmail;
    public void ChangePassword(string newPasswordHash) => PasswordHash = newPasswordHash;
    public void ChangeRole(Role newRole) => UserRoles = newRole;
    public void DeleteThisUser() => IsDeleted = true;

    public void UpdateCredentials(string username, string surname, string name)
    {
        Username = username;
        Surname = surname;
        Name = name;
    }
}