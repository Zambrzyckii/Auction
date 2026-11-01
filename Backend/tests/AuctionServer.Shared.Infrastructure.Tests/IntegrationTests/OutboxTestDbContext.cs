using AuctionServer.Shared.Infrastructure.Inbox;
using AuctionServer.Shared.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Shared.Infrastructure.Tests.IntegrationTests;

public sealed class OutboxTestDbContext(DbContextOptions<OutboxTestDbContext> options) : DbContext(options)
{
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<ProcessedMessage> ProcessedMessages => Set<ProcessedMessage>();
    public DbSet<TestDomainRecord> DomainRecords => Set<TestDomainRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        OutboxMessageModel.Configure(modelBuilder.Entity<OutboxMessage>(), "TestOutboxMessages");
        ProcessedMessageModel.Configure(modelBuilder.Entity<ProcessedMessage>(), "TestProcessedMessages");

        var record = modelBuilder.Entity<TestDomainRecord>();
        record.ToTable("TestDomainRecords");
        record.HasKey(r => r.Id);
        record.HasIndex(r => r.Code).IsUnique();
    }
}
