using System.Net;
using System.Text.Json;

namespace AuctionServer.Api.Infrastructure.Secrets;

public sealed class VaultConfigurationProvider(VaultOptions options, HttpMessageHandler? handler = null)
    : ConfigurationProvider
{
    public override void Load()
    {
        try
        {
            LoadAsync().GetAwaiter().GetResult();
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            throw new InvalidOperationException(
                $"Vault at '{options.Address}' is unreachable or timed out after {options.TimeoutSeconds} s",
                exception);
        }
    }

    private async Task LoadAsync()
    {
        using var client = handler is null ? new HttpClient() : new HttpClient(handler, disposeHandler: false);
        client.BaseAddress = new Uri(options.Address, UriKind.Absolute);
        client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);

        var token = await LoginAsync(client);
        var secrets = await ReadSecretsAsync(client, token);
        Data = Flatten(secrets);
    }

    private async Task<string> LoginAsync(HttpClient client)
    {
        var roleId = await ReadCredentialFileAsync("Vault:RoleIdFile", options.RoleIdFile);
        var secretId = await ReadCredentialFileAsync("Vault:SecretIdFile", options.SecretIdFile);

        var credentials = new Dictionary<string, string> { ["role_id"] = roleId, ["secret_id"] = secretId };
        using var response = await client.PostAsJsonAsync("v1/auth/approle/login", credentials);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Vault AppRole login at '{options.Address}' failed with status {(int)response.StatusCode}");

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var token = payload.RootElement.GetProperty("auth").GetProperty("client_token").GetString();
        return string.IsNullOrEmpty(token)
            ? throw new InvalidOperationException("Vault AppRole login response carried no client token")
            : token;
    }

    private async Task<JsonElement> ReadSecretsAsync(HttpClient client, string token)
    {
        var secretLocation = $"{options.MountPath}/data/{options.SecretPath}";
        using var request = new HttpRequestMessage(HttpMethod.Get, $"v1/{secretLocation}");
        request.Headers.Add("X-Vault-Token", token);

        using var response = await client.SendAsync(request);
        if (response.StatusCode is HttpStatusCode.Forbidden)
            throw new InvalidOperationException(
                $"Vault denied reading '{secretLocation}', the AppRole policy does not cover it");
        if (response.StatusCode is HttpStatusCode.NotFound)
            throw new InvalidOperationException($"Vault has no secret at '{secretLocation}'");
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Vault read of '{secretLocation}' failed with status {(int)response.StatusCode}");

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return payload.RootElement.GetProperty("data").GetProperty("data").Clone();
    }

    private static async Task<string> ReadCredentialFileAsync(string key, string path)
    {
        if (!File.Exists(path))
            throw new InvalidOperationException($"{key} points at '{path}' which does not exist");

        var value = (await File.ReadAllTextAsync(path)).Trim();
        return value.Length == 0
            ? throw new InvalidOperationException($"{key} points at '{path}' which is empty")
            : value;
    }

    private static Dictionary<string, string?> Flatten(JsonElement secrets)
    {
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var secret in secrets.EnumerateObject())
        {
            result[secret.Name] = secret.Value.GetString();
        }

        return result;
    }
}
