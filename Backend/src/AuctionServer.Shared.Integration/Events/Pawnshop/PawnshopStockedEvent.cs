using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopStockedEvent(Guid EventId, Guid PublicPawnshopId, Guid RequestId, IReadOnlyList<PawnshopStockItem> Stock) : INotification;
