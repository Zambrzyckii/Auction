using MediatR;

namespace AuctionServer.Shared.Integration.Events.Pawnshop;

public record PawnshopPaymentRejectedEvent(Guid EventId, Guid PublicPawnshopId, Guid PaymentId, Guid UserId, string Reason) : INotification;
