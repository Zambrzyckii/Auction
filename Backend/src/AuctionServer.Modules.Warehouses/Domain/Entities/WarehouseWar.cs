using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;

namespace AuctionServer.Modules.Warehouses.Domain.Entities;

public sealed class WarehouseWar
{
    public int Id { get; init; }
    public Guid PublicWarehouseId { get; init; } = Guid.NewGuid();
    public required string Tier { get; init; }
    public WarehouseWarStatus Status { get; private set; } = WarehouseWarStatus.Stocking;
    public decimal TotalValue { get; private set; }
    public decimal EstimateMin { get; private set; }
    public decimal EstimateMax { get; private set; }
    public decimal EntryFee { get; init; }
    public decimal CurrentPrice { get; private set; }
    public Guid? CurrentLeaderId { get; private set; }
    public DateTime? BiddingStartsOn { get; private set; }
    public DateTime? BiddingEndsOn { get; private set; }
    public string? CancellationReason { get; private set; }
    public DateTime CreatedOn { get; init; } = DateTime.UtcNow;
    public Guid Version { get; private set; } = Guid.NewGuid();
    private readonly List<WarehouseParticipant> _participants = [];

    public IReadOnlyCollection<WarehouseParticipant> Participants => _participants;

    public static WarehouseWar Create(string tier, decimal entryFee)
    {
        if (entryFee <= 0) throw new WarehouseExceptions.InvalidEntryFeeException();

        return new WarehouseWar { Tier = tier, EntryFee = entryFee };
    }

    public void OpenLobby(decimal totalValue, decimal estimateMin, decimal estimateMax)
    {
        if (Status != WarehouseWarStatus.Stocking) throw new WarehouseExceptions.WarNotStockingException(Status);
        if (totalValue <= 0 || estimateMin <= 0 || estimateMax < estimateMin)
            throw new WarehouseExceptions.InvalidEstimateException();

        TotalValue = totalValue;
        EstimateMin = estimateMin;
        EstimateMax = estimateMax;
        Status = WarehouseWarStatus.Open;
        Version = Guid.NewGuid();
    }

    public void Join(Guid userId, int maxPlayers)
    {
        if (Status != WarehouseWarStatus.Open) throw new WarehouseExceptions.WarNotOpenException(Status);
        if (BiddingStartsOn is not null && BiddingStartsOn <= DateTime.UtcNow)
            throw new WarehouseExceptions.JoinCountdownFinishedException();
        if (_participants.Any(p => p.UserId == userId)) throw new WarehouseExceptions.AlreadyParticipantException();
        if (_participants.Count >= maxPlayers) throw new WarehouseExceptions.WarehouseFullException();

        _participants.Add(new WarehouseParticipant { UserId = userId });
        Version = Guid.NewGuid();
    }

    public void Leave(Guid userId)
    {
        if (Status != WarehouseWarStatus.Open) throw new WarehouseExceptions.WarNotOpenException(Status);
        if (BiddingStartsOn is not null && BiddingStartsOn <= DateTime.UtcNow)
            throw new WarehouseExceptions.JoinCountdownFinishedException();

        _participants.Remove(GetParticipant(userId));
        Version = Guid.NewGuid();
    }

    public void ConfirmParticipant(Guid userId, int minPlayers, int maxPlayers, TimeSpan joinCountdown)
    {
        if (Status != WarehouseWarStatus.Open) throw new WarehouseExceptions.WarNotOpenException(Status);

        GetParticipant(userId).Activate();

        var activeCount = _participants.Count(p => p.State == ParticipantState.Active);
        
        if (activeCount >= maxPlayers) BiddingStartsOn = DateTime.UtcNow;
        else if(activeCount >= minPlayers && BiddingStartsOn is null) BiddingStartsOn = DateTime.UtcNow + joinCountdown;
        
        Version = Guid.NewGuid();
    }

    public void RemoveParticipant(Guid userId)
    {
        _participants.Remove(GetParticipant(userId));
        Version = Guid.NewGuid();
    }

    public void Cancel(string reason)
    {
        if (Status is WarehouseWarStatus.Settled or WarehouseWarStatus.Cancelled)
            throw new WarehouseExceptions.InvalidWarStateTransitionException(Status, WarehouseWarStatus.Cancelled);

        Status = WarehouseWarStatus.Cancelled;
        CancellationReason = reason;
        Version = Guid.NewGuid();
    }

    private WarehouseParticipant GetParticipant(Guid userId) =>
        _participants.SingleOrDefault(p => p.UserId == userId)
        ?? throw new WarehouseExceptions.ParticipantNotFoundException();
}
