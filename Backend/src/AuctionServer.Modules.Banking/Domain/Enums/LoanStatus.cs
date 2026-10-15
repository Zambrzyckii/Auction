namespace AuctionServer.Modules.Banking.Domain.Enums;

public enum LoanStatus
{
    PendingApproval = 0,
    Active = 1,
    CollectionPending = 2,
    Overdue = 3,
    Repaid = 4,
    Rejected = 5
}
