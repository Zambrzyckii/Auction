using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AuctionServer.Modules.Identity.Application.Commands.Login;

public sealed class LoginCommandHandler(IAuthRepository repository, IConfiguration configuration) : IRequestHandler<LoginCommand, string>
{
    private static readonly TimeSpan PlayerTokenLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan BotTokenLifetime = TimeSpan.FromHours(24);
    
    public async Task<string> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        
        var user = await repository.GetUserByEmailAsync(request.Email, cancellationToken);
        if (user is null) throw new IdentityException.InvalidCredentialsException("Invalid credentials provided");

        var isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if(!isPasswordValid) throw new IdentityException.InvalidCredentialsException("Invalid credentials provided");

        var tokenLifetime = user.UserRoles == Role.Bot ? BotTokenLifetime : PlayerTokenLifetime;
        
        var jwtKeyString = configuration["Jwt:Key"];

        if (string.IsNullOrEmpty(jwtKeyString) || jwtKeyString.Length < 32) throw new IdentityException.MissingConfigurationException();

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

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return tokenString;
    }
}