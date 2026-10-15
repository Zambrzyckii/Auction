using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopPaymentRequestedEvent(Guid EventId, Guid PublicPawnshopId, Guid PaymentId, Guid UserId, decimal Amount, decimal RequiredTurnover) : INotification;
