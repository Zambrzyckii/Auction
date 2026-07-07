using AuctionServer.Modules.Auctions.Application.Interfaces.Repository;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Infrastructure.Repositories;

public class AuctionRepository(AppDbContext context) : IAuctionRepository
{
    public async Task SaveAuctionAsync(Auction auction, CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }

    public async Task<Auction?> GetAuctionByIdAsync(Guid publicAuctionId, CancellationToken token)
    {
        Auction? auction = await context.Auctions.SingleOrDefaultAsync(x => x.PublicAuctionId == publicAuctionId, token);
        if (auction is null) throw new AuctionExceptions.AuctionNotFoundException(publicAuctionId);
        return auction;
    }
}