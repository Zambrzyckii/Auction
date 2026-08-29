using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace AuctionServer.Api.Infrastructure.Authentication;

public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<ApiKeyAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<ApiKeyAuthenticationOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(ApiKeyAuthenticationOptions.HeaderName, out var provided))
            return Task.FromResult(AuthenticateResult.NoResult());
        if (string.IsNullOrEmpty(Options.ApiKey))
            return Task.FromResult(AuthenticateResult.Fail("API key authentication is not configured"));
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Options.ApiKey), Encoding.UTF8.GetBytes(provided.ToString())))
            return Task.FromResult(AuthenticateResult.Fail("Invalid API key"));

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "bot-provisioner")], Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
    }
}
