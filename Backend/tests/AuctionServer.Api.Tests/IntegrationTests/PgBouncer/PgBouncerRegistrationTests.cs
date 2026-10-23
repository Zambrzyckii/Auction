using System.Net;
using System.Net.Http.Json;

namespace AuctionServer.Api.Tests.IntegrationTests.PgBouncer;

[Collection(PgBouncerCollection.Name)]
public class PgBouncerRegistrationTests(PgBouncerFixture fixture)
{
    private const int Attempts = 10;

    [Fact]
    public async Task Register_WhenSameEmailArrivesConcurrently_ShouldCreateExactlyOneUser()
    {
        using var client = fixture.Factory.CreateClient();
        var request = new
        {
            Email = "pooled@player.test",
            Password = "Pooled-Pass1",
            Username = "pooled-player",
            Name = "Pooled",
            Surname = "Player",
            Birthday = new DateOnly(2000, 1, 1)
        };

        var responses = await Task.WhenAll(Enumerable.Range(0, Attempts)
            .Select(_ => client.PostAsJsonAsync("/api/users/register", request)));
        var statuses = responses.Select(response => response.StatusCode).ToList();

        Assert.Single(statuses, status => status == HttpStatusCode.Created);
        Assert.Equal(Attempts - 1, statuses.Count(status => status == HttpStatusCode.Conflict));
    }
}
