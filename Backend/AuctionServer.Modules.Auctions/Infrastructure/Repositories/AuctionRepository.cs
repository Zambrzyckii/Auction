using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;
using AuctionServer.Modules.Auctions.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Infrastructure.Repositories;

public class AuctionRepository(AppDbContext context) : IAuctionRepository
{
    public async Task SaveAuctionAsync(Auction auction)
    {
        await context.SaveChangesAsync();
    }

    public async Task<Auction> GetAuctionByIdAsync(Guid publicAuctionId)
    {
        Auction auctionTemp = await context.Auctions.SingleAsync(auction => auction.PublicAuctionId == publicAuctionId);
        return auctionTemp;
    }
}