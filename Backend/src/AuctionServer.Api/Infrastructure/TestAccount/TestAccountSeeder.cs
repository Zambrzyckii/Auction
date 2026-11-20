using AuctionServer.Modules.Identity.Application.Commands.Register;
using AuctionServer.Modules.Identity.Application.Queries.GetUserIdByEmail;
using AuctionServer.Modules.Inventory.Application.Command.GrantItem;
using AuctionServer.Modules.Inventory.Application.Queries.GetUserItemsQuery;
using AuctionServer.Modules.Wallets.Application.Command.AddFunds;
using AuctionServer.Modules.Wallets.Application.Queries.GetWallet;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Api.Infrastructure.TestAccount;

public sealed class TestAccountSeeder(IServiceProvider serviceProvider, ILogger<TestAccountSeeder> logger, TestAccountOptions options)
    : BackgroundService
{
    private static readonly DateOnly Birthday = new(2000, 1, 1);
    private static readonly TimeSpan WalletWaitLimit = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await SeedAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Seeding the test account {Email} failed", options.Email);
        }
    }

    private async Task SeedAsync(CancellationToken token)
    {
        using var scope = serviceProvider.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var userId = await FindOrRegisterAsync(sender, token);
        var wallet = await WaitForWalletAsync(sender, userId, token);

        var addedFunds = 0m;
        if (wallet.AvailableFunds < options.Funds)
        {
            await sender.Send(new AddFundsCommand(userId, options.Funds), token);
            addedFunds = options.Funds;
        }

        var owned = await sender.Send(new GetUserItemsQuery(userId), token);
        var missing = TestAccountCatalog.Missing(owned.Select(item => new TestAccountItem(item.Name, item.Rarity)), options.Copies);
        foreach (var item in missing)
            await sender.Send(new GrantItemCommand(userId, item.Name, item.Rarity), token);

        logger.LogInformation("Test account {Email} is ready after adding {Funds} funds and {Items} items",
            options.Email, addedFunds, missing.Count);
    }

    private async Task<Guid> FindOrRegisterAsync(ISender sender, CancellationToken token)
    {
        var existingId = await sender.Send(new GetUserIdByEmailQuery(options.Email), token);
        if (existingId is not null) return existingId.Value;

        await sender.Send(new RegisterCommand(options.Email, options.Password, options.Username, "Test", "Account", Birthday), token);

        var registeredId = await sender.Send(new GetUserIdByEmailQuery(options.Email), token);
        return registeredId ?? throw new InvalidOperationException($"Test account {options.Email} is missing right after registration");
    }

    private static async Task<WalletDto> WaitForWalletAsync(ISender sender, Guid userId, CancellationToken token)
    {
        var deadline = DateTime.UtcNow + WalletWaitLimit;
        while (true)
        {
            try
            {
                return await sender.Send(new GetWalletQuery(userId), token);
            }
            catch (WalletExceptions.UserWithThisIdDontHaveWallet) when (DateTime.UtcNow < deadline)
            {
                await Task.Delay(TimeSpan.FromSeconds(1), token);
            }
        }
    }
}
