using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopStockRequestedEvent(Guid EventId, Guid PublicPawnshopId, IReadOnlyList<string> Rarities) : INotification;
