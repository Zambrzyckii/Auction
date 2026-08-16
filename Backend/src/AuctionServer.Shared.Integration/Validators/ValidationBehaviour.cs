using AuctionServer.Shared.Integration.Exceptions;
using FluentValidation;
using MediatR;

namespace AuctionServer.Shared.Integration.Validators;

public sealed class ValidationBehaviour<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators) : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (!validators.Any()) return await next(cancellationToken);

        var failures = validators
            .Select(v => v.Validate(request))
            .SelectMany(result => result.Errors)
            .Where(f => f is not null)
            .ToList();
        if (failures.Count != 0) throw new RequestValidationException(string.Join("; ", failures.Select(f => f.ErrorMessage)));

        return await next(cancellationToken);
    }
}
