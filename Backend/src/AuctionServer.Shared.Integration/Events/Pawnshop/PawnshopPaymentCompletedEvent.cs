using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopPaymentCompletedEvent(Guid EventId, Guid PublicPawnshopId, Guid PaymentId, Guid UserId) : INotification;
