using System.Security.Cryptography;
using AuctionServer.Modules.Casino.Application.Interfaces;

namespace AuctionServer.Modules.Casino.Infrastructure.Random;

public sealed class CasinoRandom : ICasinoRandom
{
    public int Next(int exclusiveMax) => RandomNumberGenerator.GetInt32(exclusiveMax);
}
