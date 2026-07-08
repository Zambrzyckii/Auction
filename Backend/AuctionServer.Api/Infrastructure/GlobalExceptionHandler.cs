using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Api.Infrastructure;

public class GlobalExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken token)
    {
        if (exception is AppException appException)
        {
            context.Response.StatusCode = appException.StatusCode;
            await context.Response.WriteAsJsonAsync(new { Error = appException.Message }, token);
            return true;
        }

        if (exception is DbUpdateConcurrencyException)
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            await context.Response.WriteAsJsonAsync(new { Error = "Data corrupted, try again" }, token);
            return true;
        }
        
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new { Error = "Unhandled error occured" }, token);
        return true;
    }
}