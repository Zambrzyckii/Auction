using AuctionServer.Modules.Banking.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuctionServer.Modules.Banking.Infrastructure.Configuration;

internal sealed class LoanConfiguration : IEntityTypeConfiguration<Loan>
{
    public void Configure(EntityTypeBuilder<Loan> builder)
    {
        builder.ToTable("BankingLoans");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.PublicLoanId).IsUnique();
        builder.HasIndex(x => x.UserId).IsUnique().HasFilter("\"Status\" IN (0, 1, 2, 3)");
        builder.HasIndex(x => new { x.Status, x.DueOn });
        builder.Property(x => x.OfferName).IsRequired().HasMaxLength(64);
        builder.Property(x => x.Principal).HasPrecision(18, 2);
        builder.Property(x => x.InterestRate).HasPrecision(5, 4);
        builder.Property(x => x.PenaltyRate).HasPrecision(5, 4);
        builder.Property(x => x.RequiredTurnover).HasPrecision(18, 2);
        builder.Property(x => x.TotalDue).HasPrecision(18, 2);
        builder.Property(x => x.Penalty).HasPrecision(18, 2);
        builder.Property(x => x.AmountRepaid).HasPrecision(18, 2);
        builder.Property(x => x.RejectionReason).HasMaxLength(256);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.Ignore(x => x.Outstanding);
    }
}
