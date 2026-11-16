using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AuctionServer.Modules.Identity.Application.Tokens;

public sealed class JwtTokenFactory(IConfiguration configuration)
{
    public static readonly TimeSpan PlayerTokenLifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan BotTokenLifetime = TimeSpan.FromHours(24);

    public string Create(User user)
    {
        var jwtKeyString = configuration["Jwt:Key"];
        if (string.IsNullOrEmpty(jwtKeyString) || jwtKeyString.Length < 32) throw new IdentityException.MissingConfigurationException();

        var tokenLifetime = user.UserRoles == Role.Bot ? BotTokenLifetime : PlayerTokenLifetime;
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(jwtKeyString);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(ClaimTypes.Name, user.Email),
                new Claim(ClaimTypes.NameIdentifier, user.PublicUserId.ToString()),
                new Claim(ClaimTypes.Role, user.UserRoles.ToString())
            ]),
            Issuer = configuration["Jwt:Issuer"],
            Audience = configuration["Jwt:Audience"],
            Expires = DateTime.UtcNow.Add(tokenLifetime),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        return tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));
    }
}
