using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

public sealed class OutboxTestDbContext(DbContextOptions<OutboxTestDbContext> options) : DbContext(options)
{
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
        => OutboxMessageModel.Configure(modelBuilder.Entity<OutboxMessage>(), "TestOutboxMessages");
}
