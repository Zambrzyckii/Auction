namespace AuctionServer.Modules.Casino.Application.Interfaces;

public interface ICasinoRandom
{
    int Next(int exclusiveMax);
}
