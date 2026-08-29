namespace AuctionServer.Modules.Identity.Presentation.Request;

public record RegisterBotRequest (string Email, string Password, string Username, string Name, string Surname, DateOnly Birthday);