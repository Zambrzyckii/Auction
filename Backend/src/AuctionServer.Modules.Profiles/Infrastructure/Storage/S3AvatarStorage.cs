using System.Net;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Infrastructure.Storage;

public sealed class S3AvatarStorage(StorageOptions options) : IAvatarStorage, IDisposable
{
    private readonly Lazy<AmazonS3Client> _client = new(() => CreateClient(options));
    private readonly SemaphoreSlim _bucketLock = new(1, 1);
    private volatile bool _bucketReady;

    private static AmazonS3Client CreateClient(StorageOptions options)
    {
        var config = new AmazonS3Config
        {
            ServiceURL = options.ServiceUrl,
            ForcePathStyle = options.ForcePathStyle,
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED
        };
        return new AmazonS3Client(new AnonymousAWSCredentials(), config);
    }

    private static string KeyFor(Guid userId) => $"avatars/{userId:N}";

    public async Task PutAsync(Guid userId, byte[] payload, string contentType, CancellationToken token)
    {
        await EnsureBucketAsync(token);
        var request = new PutObjectRequest
        {
            BucketName = options.Bucket,
            Key = KeyFor(userId),
            InputStream = new MemoryStream(payload),
            ContentType = contentType
        };
        await SendAsync(() => _client.Value.PutObjectAsync(request, token));
    }

    public async Task<AvatarDownload?> GetAsync(Guid userId, CancellationToken token)
    {
        try
        {
            var response = await SendAsync(() => _client.Value.GetObjectAsync(options.Bucket, KeyFor(userId), token));
            return new AvatarDownload(response.ResponseStream, response.Headers.ContentType);
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task DeleteAsync(Guid userId, CancellationToken token)
    {
        try
        {
            await SendAsync(() => _client.Value.DeleteObjectAsync(options.Bucket, KeyFor(userId), token));
        }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound)
        {
            
        }
    }

    private async Task EnsureBucketAsync(CancellationToken token)
    {
        if (_bucketReady) return;
        await _bucketLock.WaitAsync(token);
        try
        {
            if (_bucketReady) return;
            try
            {
                await SendAsync(() => _client.Value.PutBucketAsync(options.Bucket, token));
            }
            catch (AmazonS3Exception e) when (e.ErrorCode is "BucketAlreadyOwnedByYou" or "BucketAlreadyExists")
            {
            }

            _bucketReady = true;
        }
        finally
        {
            _bucketLock.Release();
        }
    }

    private static async Task<T> SendAsync<T>(Func<Task<T>> send)
    {
        try
        {
            return await send();
        }
        catch (Exception e) when (e is HttpRequestException || e.InnerException is HttpRequestException)
        {
            throw new ProfilesExceptions.AvatarStorageUnavailableException();
        }
    }

    public void Dispose()
    {
        if(_client.IsValueCreated) _client.Value.Dispose();
        _bucketLock.Dispose();
    }
}
