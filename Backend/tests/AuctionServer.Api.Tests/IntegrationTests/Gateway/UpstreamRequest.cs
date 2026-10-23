namespace AuctionServer.Api.Tests.IntegrationTests.Gateway;

public sealed record UpstreamRequest(string RequestLine, IReadOnlyDictionary<string, string> Headers)
{
    public string? Header(string name)
    {
        return Headers.GetValueOrDefault(name);
    }

    public static UpstreamRequest Parse(string whoamiOutput)
    {
        var lines = whoamiOutput.Split('\n').Select(line => line.TrimEnd('\r')).ToList();
        var requestLineIndex = lines.FindIndex(line => line.Contains(" HTTP/1."));
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var line in lines.Skip(requestLineIndex + 1).TakeWhile(line => line.Length > 0))
        {
            var separator = line.IndexOf(": ", StringComparison.Ordinal);
            headers[line[..separator]] = line[(separator + 2)..];
        }

        return new UpstreamRequest(lines[requestLineIndex], headers);
    }
}
