namespace AuctionServer.Modules.Inventory.Domain.Enums;

public enum ItemStatus
{
    Available,
    LockedForAuction,
    SoldToShop,
    Consumed
}