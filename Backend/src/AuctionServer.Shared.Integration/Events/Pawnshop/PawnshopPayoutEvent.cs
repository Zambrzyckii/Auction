using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopPayoutEvent(Guid EventId, Guid PublicPawnshopId, Guid UserId, decimal Amount) : INotification;
