using AuctionServer.Modules.Identity.Application.Tokens;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Identity.Tests.IntegrationTests;

[Collection(IdentityIntegrationCollection.Name)]
public class RefreshTokenRepositoryTests(IdentityPostgresFixture fixture)
{
    private static readonly DateTime Now = new(2026, 11, 15, 12, 0, 0, DateTimeKind.Utc);

    private async Task<User> SeedUserAsync() => await fixture.SeedUserAsync(IdentityPostgresFixture.UniqueEmail());

    private async Task<RefreshToken?> FindAsync(Guid id)
    {
        await using var context = fixture.CreateContext();
        return await context.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(t => t.Id == id);
    }

    [Fact]
    public async Task SaveChangesAsync_ShouldPersistAnAddedTokenFindableByHash()
    {
        var user = await SeedUserAsync();
        var raw = RefreshTokenSecret.Generate();
        var token = RefreshToken.Issue(user.Id, Guid.NewGuid(), RefreshTokenSecret.Hash(raw), Now);

        await using (var context = fixture.CreateContext())
        {
            var repository = new RefreshTokenRepository(context);
            repository.Add(token);
            await repository.SaveChangesAsync(CancellationToken.None);
        }

        await using var verifyContext = fixture.CreateContext();
        var stored = await new RefreshTokenRepository(verifyContext)
            .GetByHashAsync(RefreshTokenSecret.Hash(raw), CancellationToken.None);
        Assert.NotNull(stored);
        Assert.Equal(token.Id, stored.Id);
        Assert.Equal(user.Id, stored.UserId);
        Assert.Equal(Now.AddDays(7), stored.ExpiresOn);
    }

    [Fact]
    public async Task SaveChangesAsync_WhenHashAlreadyExists_ShouldThrow()
    {
        var user = await SeedUserAsync();
        var (seeded, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), Now);

        await using var context = fixture.CreateContext();
        var repository = new RefreshTokenRepository(context);
        repository.Add(RefreshToken.Issue(user.Id, Guid.NewGuid(), seeded.TokenHash, Now));

        await Assert.ThrowsAsync<DbUpdateException>(() => repository.SaveChangesAsync(CancellationToken.None));
    }

    [Fact]
    public async Task GetByHashAsync_WhenHashIsUnknown_ShouldReturnNull()
    {
        await using var context = fixture.CreateContext();

        var stored = await new RefreshTokenRepository(context)
            .GetByHashAsync(RefreshTokenSecret.Hash("unknown"), CancellationToken.None);

        Assert.Null(stored);
    }

    [Fact]
    public async Task GetUserAsync_WhenUserIsSoftDeleted_ShouldReturnNull()
    {
        var user = await SeedUserAsync();

        await using (var context = fixture.CreateContext())
        {
            Assert.NotNull(await new RefreshTokenRepository(context).GetUserAsync(user.Id, CancellationToken.None));
            var tracked = await context.Users.SingleAsync(u => u.Id == user.Id);
            tracked.DeleteThisUser();
            await context.SaveChangesAsync();
        }

        await using var verifyContext = fixture.CreateContext();
        Assert.Null(await new RefreshTokenRepository(verifyContext).GetUserAsync(user.Id, CancellationToken.None));
    }

    [Fact]
    public async Task RemoveDeadAsync_ShouldDeleteOnlyTheUsersDeadRowsOlderThanTheLifetime()
    {
        var user = await SeedUserAsync();
        var other = await SeedUserAsync();
        var family = Guid.NewGuid();
        var (oldRevoked, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), Now.AddDays(-8), Now.AddDays(-8).AddMinutes(1));
        var (oldExpired, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), Now.AddDays(-9));
        var (youngRevoked, _) = await fixture.SeedRefreshTokenAsync(user.Id, family, Now.AddDays(-2), Now.AddDays(-2).AddMinutes(1));
        var (active, _) = await fixture.SeedRefreshTokenAsync(user.Id, family, Now.AddDays(-1));
        var (otherUsers, _) = await fixture.SeedRefreshTokenAsync(other.Id, Guid.NewGuid(), Now.AddDays(-8), Now.AddDays(-8).AddMinutes(1));

        await using (var context = fixture.CreateContext())
        {
            var repository = new RefreshTokenRepository(context);
            await repository.RemoveDeadAsync(user.Id, Now, CancellationToken.None);
            await repository.SaveChangesAsync(CancellationToken.None);
        }

        Assert.Null(await FindAsync(oldRevoked.Id));
        Assert.Null(await FindAsync(oldExpired.Id));
        Assert.NotNull(await FindAsync(youngRevoked.Id));
        Assert.NotNull(await FindAsync(active.Id));
        Assert.NotNull(await FindAsync(otherUsers.Id));
    }

    [Fact]
    public async Task SaveChangesAsync_WhenTheSameTokenIsRevokedInTwoContexts_ShouldThrowConcurrencyForTheSecond()
    {
        var user = await SeedUserAsync();
        var family = Guid.NewGuid();
        var (seeded, _) = await fixture.SeedRefreshTokenAsync(user.Id, family, Now.AddDays(-1));

        await using var contextA = fixture.CreateContext();
        await using var contextB = fixture.CreateContext();
        var repositoryA = new RefreshTokenRepository(contextA);
        var repositoryB = new RefreshTokenRepository(contextB);
        var loadedA = (await repositoryA.GetByHashAsync(seeded.TokenHash, CancellationToken.None))!;
        var loadedB = (await repositoryB.GetByHashAsync(seeded.TokenHash, CancellationToken.None))!;
        loadedA.Revoke(Now);
        repositoryA.Add(RefreshToken.Issue(user.Id, family, RefreshTokenSecret.Hash(RefreshTokenSecret.Generate()), Now));
        loadedB.Revoke(Now);
        repositoryB.Add(RefreshToken.Issue(user.Id, family, RefreshTokenSecret.Hash(RefreshTokenSecret.Generate()), Now));

        await repositoryA.SaveChangesAsync(CancellationToken.None);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => repositoryB.SaveChangesAsync(CancellationToken.None));

        await using var verifyContext = fixture.CreateContext();
        Assert.Equal(2, await verifyContext.RefreshTokens.CountAsync(t => t.FamilyId == family));
    }

    [Fact]
    public async Task RevokeFamilyAsync_ShouldRevokeEveryActiveRowOfThatFamilyOnly()
    {
        var user = await SeedUserAsync();
        var family = Guid.NewGuid();
        var (active, _) = await fixture.SeedRefreshTokenAsync(user.Id, family, Now.AddDays(-1));
        var (revoked, _) = await fixture.SeedRefreshTokenAsync(user.Id, family, Now.AddDays(-1), Now.AddHours(-12));
        var (otherFamily, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), Now.AddDays(-1));

        await using (var context = fixture.CreateContext())
        {
            await new RefreshTokenRepository(context).RevokeFamilyAsync(family, Now, CancellationToken.None);
        }

        Assert.Equal(Now, (await FindAsync(active.Id))!.RevokedOn);
        Assert.Equal(Now.AddHours(-12), (await FindAsync(revoked.Id))!.RevokedOn);
        Assert.Null((await FindAsync(otherFamily.Id))!.RevokedOn);
    }

    [Fact]
    public async Task RevokeFamilyAsync_ShouldMakeAStagedRotationOfTheFamilyFail()
    {
        var user = await SeedUserAsync();
        var family = Guid.NewGuid();
        var (seeded, _) = await fixture.SeedRefreshTokenAsync(user.Id, family, Now.AddDays(-1));

        await using var contextA = fixture.CreateContext();
        var repositoryA = new RefreshTokenRepository(contextA);
        var staged = (await repositoryA.GetByHashAsync(seeded.TokenHash, CancellationToken.None))!;
        await using (var contextB = fixture.CreateContext())
        {
            await new RefreshTokenRepository(contextB).RevokeFamilyAsync(family, Now, CancellationToken.None);
        }
        staged.Revoke(Now);
        repositoryA.Add(RefreshToken.Issue(user.Id, family, RefreshTokenSecret.Hash(RefreshTokenSecret.Generate()), Now));

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => repositoryA.SaveChangesAsync(CancellationToken.None));
    }

    [Fact]
    public async Task SaveChangesAsync_WhenTwoFamiliesOfOneUserPurgeTheSameRows_ShouldOnlyConflictNeverRevoke()
    {
        var user = await SeedUserAsync();
        var familyF = Guid.NewGuid();
        var familyG = Guid.NewGuid();
        var (dead, _) = await fixture.SeedRefreshTokenAsync(user.Id, Guid.NewGuid(), Now.AddDays(-8), Now.AddDays(-8).AddMinutes(1));
        var (tokenF, _) = await fixture.SeedRefreshTokenAsync(user.Id, familyF, Now.AddDays(-1));
        var (tokenG, _) = await fixture.SeedRefreshTokenAsync(user.Id, familyG, Now.AddDays(-1));

        await using var contextA = fixture.CreateContext();
        await using var contextB = fixture.CreateContext();
        var repositoryA = new RefreshTokenRepository(contextA);
        var repositoryB = new RefreshTokenRepository(contextB);
        (await repositoryA.GetByHashAsync(tokenF.TokenHash, CancellationToken.None))!.Revoke(Now);
        repositoryA.Add(RefreshToken.Issue(user.Id, familyF, RefreshTokenSecret.Hash(RefreshTokenSecret.Generate()), Now));
        await repositoryA.RemoveDeadAsync(user.Id, Now, CancellationToken.None);
        (await repositoryB.GetByHashAsync(tokenG.TokenHash, CancellationToken.None))!.Revoke(Now);
        repositoryB.Add(RefreshToken.Issue(user.Id, familyG, RefreshTokenSecret.Hash(RefreshTokenSecret.Generate()), Now));
        await repositoryB.RemoveDeadAsync(user.Id, Now, CancellationToken.None);

        await repositoryA.SaveChangesAsync(CancellationToken.None);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => repositoryB.SaveChangesAsync(CancellationToken.None));

        await using var verifyContext = fixture.CreateContext();
        Assert.Null(await FindAsync(dead.Id));
        Assert.Equal(1, await verifyContext.RefreshTokens.CountAsync(t => t.FamilyId == familyF && t.RevokedOn == null));
        Assert.Equal(1, await verifyContext.RefreshTokens.CountAsync(t => t.FamilyId == familyG));
        Assert.Null((await FindAsync(tokenG.Id))!.RevokedOn);
    }
}
