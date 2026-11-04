using System.Net;
using System.Text;
using AuctionServer.Api.Infrastructure.Secrets;

namespace AuctionServer.Api.Tests.Secrets;

public sealed class VaultConfigurationProviderTests : IDisposable
{
    private const string LoginResponse = """{"auth":{"client_token":"test-token"}}""";
    private const string SecretsResponse =
        """{"data":{"data":{"Jwt:Key":"from-vault","ConnectionStrings:DefaultConnection":"Host=x"}}}""";

    private readonly string _directory = Directory.CreateTempSubdirectory("vault-provider-tests-").FullName;
    private readonly FakeVaultHandler _handler = new();

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    private VaultOptions BuildOptions(string roleId = "test-role", string secretId = "test-secret")
    {
        var roleIdFile = Path.Combine(_directory, "role-id");
        var secretIdFile = Path.Combine(_directory, "secret-id");
        File.WriteAllText(roleIdFile, roleId);
        File.WriteAllText(secretIdFile, secretId);
        return new VaultOptions
        {
            Enabled = true,
            Address = "http://vault.local:8200",
            RoleIdFile = roleIdFile,
            SecretIdFile = secretIdFile,
            SecretPath = "auction/api"
        };
    }

    [Fact]
    public void Load_ShouldLoginAndExposeSecretsAsConfigurationKeys()
    {
        _handler.Enqueue(HttpStatusCode.OK, LoginResponse);
        _handler.Enqueue(HttpStatusCode.OK, SecretsResponse);
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        provider.Load();

        Assert.True(provider.TryGet("Jwt:Key", out var jwtKey));
        Assert.Equal("from-vault", jwtKey);
        Assert.True(provider.TryGet("connectionstrings:defaultconnection", out var connectionString));
        Assert.Equal("Host=x", connectionString);
    }

    [Fact]
    public void Load_ShouldSendAppRoleCredentialsAndVaultToken()
    {
        _handler.Enqueue(HttpStatusCode.OK, LoginResponse);
        _handler.Enqueue(HttpStatusCode.OK, SecretsResponse);
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        provider.Load();

        var (loginRequest, loginBody) = _handler.Recorded[0];
        Assert.Equal(HttpMethod.Post, loginRequest.Method);
        Assert.Equal("http://vault.local:8200/v1/auth/approle/login", loginRequest.RequestUri!.ToString());
        Assert.Contains("\"role_id\":\"test-role\"", loginBody);
        Assert.Contains("\"secret_id\":\"test-secret\"", loginBody);

        var (readRequest, _) = _handler.Recorded[1];
        Assert.Equal(HttpMethod.Get, readRequest.Method);
        Assert.Equal("http://vault.local:8200/v1/secret/data/auction/api", readRequest.RequestUri!.ToString());
        Assert.Equal("test-token", Assert.Single(readRequest.Headers.GetValues("X-Vault-Token")));
    }

    [Fact]
    public void Load_WhenLoginIsRejected_ShouldThrow()
    {
        _handler.Enqueue(HttpStatusCode.BadRequest, """{"errors":["invalid role or secret ID"]}""");
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("AppRole login", exception.Message);
        Assert.Contains("status 400", exception.Message);
    }

    [Fact]
    public void Load_WhenLoginResponseHasNoToken_ShouldThrow()
    {
        _handler.Enqueue(HttpStatusCode.OK, """{"auth":{"client_token":""}}""");
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("no client token", exception.Message);
    }

    [Fact]
    public void Load_WhenReadIsForbidden_ShouldThrow()
    {
        _handler.Enqueue(HttpStatusCode.OK, LoginResponse);
        _handler.Enqueue(HttpStatusCode.Forbidden, """{"errors":["permission denied"]}""");
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("policy", exception.Message);
        Assert.Contains("secret/data/auction/api", exception.Message);
    }

    [Fact]
    public void Load_WhenSecretIsMissing_ShouldThrow()
    {
        _handler.Enqueue(HttpStatusCode.OK, LoginResponse);
        _handler.Enqueue(HttpStatusCode.NotFound, """{"errors":[]}""");
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("has no secret at 'secret/data/auction/api'", exception.Message);
    }

    [Fact]
    public void Load_WhenVaultIsUnreachable_ShouldThrow()
    {
        _handler.Throws = new HttpRequestException("connection refused");
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("unreachable or timed out", exception.Message);
        Assert.Contains("http://vault.local:8200", exception.Message);
    }

    [Fact]
    public void Load_WhenVaultTimesOut_ShouldThrow()
    {
        _handler.Throws = new TaskCanceledException("the request was canceled due to the configured timeout");
        var provider = new VaultConfigurationProvider(BuildOptions(), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("unreachable or timed out", exception.Message);
    }

    [Fact]
    public void Load_WhenRoleIdFileIsMissing_ShouldThrow()
    {
        var options = BuildOptions();
        File.Delete(options.RoleIdFile);
        var provider = new VaultConfigurationProvider(options, _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("Vault:RoleIdFile", exception.Message);
        Assert.Contains("does not exist", exception.Message);
    }

    [Fact]
    public void Load_WhenSecretIdFileIsEmpty_ShouldThrow()
    {
        var provider = new VaultConfigurationProvider(BuildOptions(secretId: " "), _handler);

        var exception = Assert.Throws<InvalidOperationException>(provider.Load);

        Assert.Contains("Vault:SecretIdFile", exception.Message);
        Assert.Contains("is empty", exception.Message);
    }

    private sealed class FakeVaultHandler : HttpMessageHandler
    {
        private readonly Queue<(HttpStatusCode Status, string Json)> _responses = new();

        public List<(HttpRequestMessage Request, string Body)> Recorded { get; } = [];
        public Exception? Throws { get; set; }

        public void Enqueue(HttpStatusCode status, string json) => _responses.Enqueue((status, json));

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken);
            Recorded.Add((request, body));

            if (Throws is not null) throw Throws;

            var (status, json) = _responses.Dequeue();
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }
    }
}
